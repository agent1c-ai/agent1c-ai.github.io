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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  }
}

serve(async (req) => {
  const headers = corsHeadersFor(req.headers.get("Origin"))
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  if (req.method !== "GET") {
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

  const { data, error } = await adminClient
    .from("telegram_links")
    .select("telegram_user_id,telegram_chat_id,telegram_username,telegram_first_name,telegram_last_name,status")
    .eq("user_id", user.id)
    .eq("status", "linked")
    .maybeSingle()
  if (error) {
    return new Response(JSON.stringify({ error: `link_status_read_failed:${error.message}` }), { status: 500, headers })
  }

  const botUsername = String(Deno.env.get("TELEGRAM_BOT_USERNAME") || "HitomiTalbot").replace(/^@+/, "")
  return new Response(JSON.stringify({
    linked: Boolean(data?.telegram_user_id),
    bot_username: botUsername,
    telegram_user_id: data?.telegram_user_id ?? null,
    telegram_chat_id: data?.telegram_chat_id ?? null,
    telegram_username: data?.telegram_username ?? "",
    telegram_first_name: data?.telegram_first_name ?? "",
    telegram_last_name: data?.telegram_last_name ?? "",
  }), { status: 200, headers })
})
