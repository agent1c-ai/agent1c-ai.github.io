import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const DAILY_TOKEN_LIMIT = 12000
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
  }
}

function utcDay(){
  return new Date().toISOString().slice(0, 10)
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

  const day = utcDay()
  const { data, error } = await adminClient
    .from("daily_token_usage")
    .select("input_tokens,output_tokens")
    .eq("user_id", user.id)
    .eq("usage_date", day)
    .maybeSingle()

  if (error) {
    return new Response(JSON.stringify({ error: "Usage query failed", detail: error.message }), { status: 500, headers })
  }

  const input = Math.max(0, Number(data?.input_tokens || 0))
  const output = Math.max(0, Number(data?.output_tokens || 0))
  const used = input + output
  const remaining = Math.max(0, DAILY_TOKEN_LIMIT - used)

  return new Response(JSON.stringify({
    day,
    limit: DAILY_TOKEN_LIMIT,
    used,
    remaining,
    input_tokens: input,
    output_tokens: output,
  }), { status: 200, headers })
})
