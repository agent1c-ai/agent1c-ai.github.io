import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = new Set([
  "https://agent1c.ai",
  "https://www.agent1c.ai",
  "https://app.agent1c.ai",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
])

const HANDOFF_TTL_MS = 5 * 60 * 1000

function corsHeadersFor(origin: string | null){
  const safeOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://agent1c.ai"
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }
}

function randomCode(size = 24){
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
    .slice(0, 40)
}

function cleanString(value: unknown, max = 4096){
  return String(value ?? "").trim().slice(0, max)
}

function cleanInt(value: unknown, fallback = 3600){
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(1, Math.min(86400 * 30, Math.floor(n)))
}

serve(async (req) => {
  const headers = corsHeadersFor(req.headers.get("Origin"))
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase environment missing" }), { status: 500, headers })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const body = await req.json().catch(() => ({}))
  const action = cleanString((body as Record<string, unknown>)?.action, 32)

  if (action === "exchange") {
    const handoffCode = cleanString((body as Record<string, unknown>)?.handoff_code, 128)
    if (!handoffCode) {
      return new Response(JSON.stringify({ error: "missing handoff_code" }), { status: 400, headers })
    }
    const nowIso = new Date().toISOString()
    const { data, error } = await adminClient
      .from("android_auth_handoffs")
      .select("code,user_id,access_token,refresh_token,token_type,expires_in,user_email,provider,user_handle,expires_at,used_at")
      .eq("code", handoffCode)
      .maybeSingle()
    if (error) {
      return new Response(JSON.stringify({ error: `handoff_lookup_failed:${error.message}` }), { status: 500, headers })
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "handoff_not_found" }), { status: 404, headers })
    }
    if (data.used_at) {
      return new Response(JSON.stringify({ error: "handoff_already_used" }), { status: 410, headers })
    }
    if (String(data.expires_at || "") < nowIso) {
      return new Response(JSON.stringify({ error: "handoff_expired" }), { status: 410, headers })
    }
    const mark = await adminClient
      .from("android_auth_handoffs")
      .update({ used_at: nowIso })
      .eq("code", handoffCode)
      .is("used_at", null)
    if (mark.error) {
      return new Response(JSON.stringify({ error: `handoff_mark_used_failed:${mark.error.message}` }), { status: 500, headers })
    }
    return new Response(JSON.stringify({
      ok: true,
      session: {
        access_token: String(data.access_token || ""),
        refresh_token: String(data.refresh_token || ""),
        token_type: String(data.token_type || "bearer"),
        expires_in: Number(data.expires_in || 3600),
      },
      identity: {
        email: String(data.user_email || ""),
        provider: String(data.provider || ""),
        handle: String(data.user_handle || ""),
      },
    }), { status: 200, headers })
  }

  if (action !== "create") {
    return new Response(JSON.stringify({ error: "unsupported action" }), { status: 400, headers })
  }

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  const user = userData?.user
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const sessionRaw = (body as Record<string, unknown>)?.session
  const session = (sessionRaw && typeof sessionRaw === "object") ? sessionRaw as Record<string, unknown> : {}
  const accessToken = cleanString(session.access_token)
  const refreshToken = cleanString(session.refresh_token)
  const tokenType = cleanString(session.token_type, 32) || "bearer"
  const expiresIn = cleanInt(session.expires_in, 3600)
  if (!accessToken || !refreshToken) {
    return new Response(JSON.stringify({ error: "missing session tokens" }), { status: 400, headers })
  }

  const code = randomCode()
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + HANDOFF_TTL_MS).toISOString()
  const provider = cleanString(
    (user.app_metadata as Record<string, unknown> | undefined)?.provider
      ?? (user.user_metadata as Record<string, unknown> | undefined)?.provider
      ?? "",
    64,
  )
  const email = cleanString(user.email, 320)
  const handle = cleanString(
    (user.user_metadata as Record<string, unknown> | undefined)?.user_name
      ?? (user.user_metadata as Record<string, unknown> | undefined)?.preferred_username
      ?? "",
    128,
  )

  await adminClient
    .from("android_auth_handoffs")
    .delete()
    .eq("user_id", user.id)

  const insert = await adminClient
    .from("android_auth_handoffs")
    .insert({
      code,
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: tokenType,
      expires_in: expiresIn,
      user_email: email || null,
      provider: provider || null,
      user_handle: handle || null,
      expires_at: expiresAt,
    })
  if (insert.error) {
    return new Response(JSON.stringify({ error: `handoff_insert_failed:${insert.error.message}` }), { status: 500, headers })
  }

  return new Response(JSON.stringify({
    ok: true,
    handoff_code: code,
    expires_at: expiresAt,
  }), { status: 200, headers })
})

