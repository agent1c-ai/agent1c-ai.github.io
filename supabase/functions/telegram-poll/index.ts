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

  const link = await adminClient
    .from("telegram_links")
    .select("telegram_user_id,telegram_chat_id,status")
    .eq("user_id", user.id)
    .eq("status", "linked")
    .maybeSingle()

  if (link.error) {
    return new Response(JSON.stringify({ error: `link_read_failed:${link.error.message}` }), { status: 500, headers })
  }

  if (!link.data?.telegram_chat_id) {
    return new Response(JSON.stringify({ linked: false, messages: [] }), { status: 200, headers })
  }

  const inbox = await adminClient
    .from("telegram_inbox")
    .select("id,telegram_chat_id,telegram_user_id,telegram_username,telegram_first_name,message_text,created_at")
    .eq("user_id", user.id)
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(5)

  if (inbox.error) {
    return new Response(JSON.stringify({ error: `inbox_read_failed:${inbox.error.message}` }), { status: 500, headers })
  }

  return new Response(JSON.stringify({
    linked: true,
    messages: (inbox.data || []).map(row => ({
      id: row.id,
      text: row.message_text,
      created_at: row.created_at,
      telegram_chat_id: row.telegram_chat_id,
      telegram_user_id: row.telegram_user_id,
      telegram_username: row.telegram_username,
      telegram_first_name: row.telegram_first_name,
    })),
  }), { status: 200, headers })
})
