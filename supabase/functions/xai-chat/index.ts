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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  }
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
  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: "Supabase environment missing" }), { status: 500, headers })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const body = await req.json().catch(() => ({}))
  const model = String(body?.model || "grok-4-latest")
  const temperature = Number(body?.temperature ?? 0.4)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const xaiApiKey = Deno.env.get("XAI_API_KEY") ?? ""
  if (!xaiApiKey) {
    return new Response(JSON.stringify({ error: "Missing XAI_API_KEY" }), { status: 500, headers })
  }

  const xaiRes = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${xaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      stream: false,
      messages,
    }),
  })

  const responseJson = await xaiRes.json().catch(() => ({}))
  return new Response(JSON.stringify(responseJson), {
    status: xaiRes.status,
    headers,
  })
})
