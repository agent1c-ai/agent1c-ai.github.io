
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const DAILY_TOKEN_LIMIT = 12000
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

function utcDay(){
  return new Date().toISOString().slice(0, 10)
}

function estimateUsage(messages: any[], assistantText: string){
  const promptChars = JSON.stringify(messages || []).length
  const replyChars = String(assistantText || "").length
  const inputTokens = Math.max(1, Math.ceil(promptChars / 4))
  const outputTokens = Math.max(1, Math.ceil(replyChars / 4))
  const totalTokens = inputTokens + outputTokens
  return { inputTokens, outputTokens, totalTokens }
}

serve(async (req) => {
  const headers = corsHeadersFor(req.headers.get("Origin"))
  if (req.method === "OPTIONS") return new Response("ok", { headers })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })

  const authHeader = req.headers.get("Authorization") ?? ""
  const url = Deno.env.get("SUPABASE_URL") ?? ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!url || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase environment missing" }), { status: 500, headers })
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(url, serviceRoleKey)

  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const day = utcDay()
  const { data: existingUsage } = await adminClient
    .from("daily_token_usage")
    .select("input_tokens,output_tokens")
    .eq("user_id", user.id)
    .eq("usage_date", day)
    .maybeSingle()

  const usedBefore = Math.max(0, Number(existingUsage?.input_tokens || 0) + Number(existingUsage?.output_tokens || 0))
  if (usedBefore >= DAILY_TOKEN_LIMIT) {
    return new Response(JSON.stringify({
      error: "Daily token limit reached",
      code: "limit_reached",
      usage: {
        used: usedBefore,
        limit: DAILY_TOKEN_LIMIT,
        remaining: 0,
        day,
      },
    }), { status: 402, headers })
  }

  const body = await req.json().catch(() => ({}))
  const model = body?.model ?? "grok-4-latest"
  const temperature = body?.temperature ?? 0.4
  const messages = Array.isArray(body?.messages) ? body.messages : []

  const xaiRequest = { model, messages, temperature, stream: false }
  const xaiRes = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("XAI_API_KEY")}`,
    },
    body: JSON.stringify(xaiRequest),
  })

  const xaiJson = await xaiRes.json().catch(() => null)
  if (!xaiRes.ok) {
    return new Response(JSON.stringify(xaiJson ?? { error: "xAI request failed" }), { status: xaiRes.status, headers })
  }

  const assistantText = String(xaiJson?.choices?.[0]?.message?.content || "")
  const usage = estimateUsage(messages, assistantText)
  const { data: updatedUsage, error: usageErr } = await adminClient
    .rpc("increment_daily_token_usage", {
      p_user_id: user.id,
      p_usage_date: day,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
    })

  const usageRow = Array.isArray(updatedUsage) ? updatedUsage[0] : updatedUsage
  const usedFromWrite = Math.max(0, Number(usageRow?.input_tokens || 0) + Number(usageRow?.output_tokens || 0))
  const used = usageErr ? Math.max(0, usedBefore + usage.totalTokens) : usedFromWrite
  const remaining = Math.max(0, DAILY_TOKEN_LIMIT - used)

  return new Response(JSON.stringify({
    ...xaiJson,
    agent1c_usage: {
      used,
      limit: DAILY_TOKEN_LIMIT,
      remaining,
      day,
      consumed: usage.totalTokens,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      persisted: !usageErr,
      usage_error: usageErr?.message || "",
    },
  }), { status: 200, headers })
})
