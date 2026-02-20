import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = new Set([
  "https://agent1c.ai",
  "https://www.agent1c.ai",
  "https://app.agent1c.ai",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
])

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

function randomStartCode(size = 18){
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "").slice(0, 32)
}

serve(async (req) => {
  const headers = corsHeadersFor(req.headers.get("Origin"))
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase environment missing" }), { status: 500, headers })
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const existing = await adminClient
    .from("telegram_links")
    .select("telegram_username,telegram_user_id,status")
    .eq("user_id", user.id)
    .eq("status", "linked")
    .maybeSingle()

  const botUsername = String(Deno.env.get("TELEGRAM_BOT_USERNAME") || "HitomiTalbot").replace(/^@+/, "")
  if (existing.data?.telegram_user_id) {
    return new Response(JSON.stringify({
      linked: true,
      telegram_username: existing.data.telegram_username || "",
      telegram_user_id: existing.data.telegram_user_id,
      bot_username: botUsername,
    }), { status: 200, headers })
  }

  const startCode = randomStartCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const insertRes = await adminClient.from("telegram_link_challenges").insert({
    user_id: user.id,
    start_code: startCode,
    expires_at: expiresAt,
  })
  if (insertRes.error) {
    return new Response(JSON.stringify({ error: `link_challenge_insert_failed:${insertRes.error.message}` }), { status: 500, headers })
  }

  const deepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(startCode)}`
  return new Response(JSON.stringify({
    linked: false,
    bot_username: botUsername,
    start_code: startCode,
    deep_link: deepLink,
    expires_at: expiresAt,
  }), { status: 200, headers })
})
