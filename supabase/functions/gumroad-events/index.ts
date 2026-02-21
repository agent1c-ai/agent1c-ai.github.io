import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = new Set([
  "https://agent1c.ai",
  "https://www.agent1c.ai",
  "https://app.agent1c.ai",
])

function corsHeadersFor(origin: string | null){
  const safeOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://agent1c.ai"
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  }
}

function parseCustomFields(raw: string){
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === "object") return obj as Record<string, unknown>
  } catch {}
  return {}
}

function normalizeEmail(v: unknown){
  return String(v || "").trim().toLowerCase()
}

function normalizeHandle(v: unknown){
  return String(v || "").trim().replace(/^@+/, "").toLowerCase()
}

function shouldSetPaid(resourceName: string){
  return ["sale", "subscription_restarted", "subscription_updated"].includes(resourceName)
}

function shouldSetFree(resourceName: string){
  return ["refund", "dispute", "subscription_ended", "dispute_won"].includes(resourceName)
}

serve(async (req) => {
  const headers = corsHeadersFor(req.headers.get("Origin"))
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const relaySecret = String(Deno.env.get("GUMROAD_RELAY_SECRET") || "").trim()
  const givenSecret = String(new URL(req.url).searchParams.get("secret") || "").trim()
  if (relaySecret && givenSecret !== relaySecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase environment missing" }), { status: 500, headers })
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const contentType = String(req.headers.get("content-type") || "").toLowerCase()
  let payload: Record<string, unknown> = {}
  if (contentType.includes("application/json")) {
    payload = (await req.json().catch(() => ({}))) as Record<string, unknown>
  } else {
    const rawText = await req.text()
    const form = new URLSearchParams(rawText)
    form.forEach((value, key) => {
      payload[key] = value
    })
  }

  const resourceName = String(payload.resource_name || "sale").trim().toLowerCase()
  const directUserId = String(
    payload.agent1c_user_id
    || payload.user_id
    || "",
  ).trim()
  const customFields = parseCustomFields(String(payload.custom_fields || ""))
  const userHandle = normalizeHandle(
    payload.agent1c_handle
    || payload.x_handle
    || customFields.agent1c_handle
    || customFields.x_handle
    || customFields.twitter_handle,
  )
  const customUserId = String(
    customFields.agent1c_user_id
    || customFields.agent1c_uid
    || "",
  ).trim()
  const userEmail = normalizeEmail(payload.user_email || payload.email || customFields.email)
  let userId = customUserId || directUserId

  if (!userId && userEmail) {
    let page = 1
    const perPage = 200
    while (!userId) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (error) break
      const users = Array.isArray(data?.users) ? data.users : []
      if (!users.length) break
      const hit = users.find((u) => normalizeEmail(u.email) === userEmail)
      if (hit?.id) userId = hit.id
      if (users.length < perPage) break
      page += 1
    }
  }

  if (!userId && userHandle) {
    let page = 1
    const perPage = 200
    while (!userId) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
      if (error) break
      const users = Array.isArray(data?.users) ? data.users : []
      if (!users.length) break
      const hit = users.find((u) => {
        const identities = Array.isArray(u?.identities) ? u.identities : []
        const fromIdentity = identities.some((id) => {
          const raw = id?.identity_data || {}
          const candidate = normalizeHandle(raw?.user_name || raw?.preferred_username || raw?.screen_name)
          return candidate && candidate === userHandle
        })
        if (fromIdentity) return true
        const fromMeta = normalizeHandle(
          u?.user_metadata?.user_name
          || u?.user_metadata?.preferred_username
          || u?.user_metadata?.username
          || u?.app_metadata?.user_name
          || u?.app_metadata?.preferred_username,
        )
        return fromMeta && fromMeta === userHandle
      })
      if (hit?.id) userId = hit.id
      if (users.length < perPage) break
      page += 1
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({
      ok: true,
      ignored: true,
      reason: "user_not_found",
      resource_name: resourceName,
      email: userEmail || null,
      handle: userHandle || null,
    }), { status: 200, headers })
  }

  const { data: existingUser, error: userErr } = await adminClient.auth.admin.getUserById(userId)
  if (userErr || !existingUser?.user) {
    return new Response(JSON.stringify({
      ok: true,
      ignored: true,
      reason: "user_lookup_failed",
      resource_name: resourceName,
      user_id: userId,
      handle: userHandle || null,
    }), { status: 200, headers })
  }

  const currentMeta = (existingUser.user.app_metadata && typeof existingUser.user.app_metadata === "object")
    ? existingUser.user.app_metadata as Record<string, unknown>
    : {}
  const currentAgent = (currentMeta.agent1c && typeof currentMeta.agent1c === "object")
    ? currentMeta.agent1c as Record<string, unknown>
    : {}

  let nextTier = String(currentAgent.tier || "free").toLowerCase() === "paid" ? "paid" : "free"
  if (shouldSetPaid(resourceName)) nextTier = "paid"
  else if (shouldSetFree(resourceName)) nextTier = "free"

  const nextAgent = {
    ...currentAgent,
    tier: nextTier,
    daily_token_limit: nextTier === "paid" ? 100000 : 12000,
    source: "gumroad",
    gumroad_last_event: resourceName,
    gumroad_last_event_at: new Date().toISOString(),
  }
  const nextMeta = { ...currentMeta, agent1c: nextAgent }
  await adminClient.auth.admin.updateUserById(userId, { app_metadata: nextMeta })

  return new Response(JSON.stringify({
    ok: true,
    user_id: userId,
    email: userEmail || null,
    handle: userHandle || null,
    resource_name: resourceName,
    tier: nextTier,
  }), { status: 200, headers })
})
