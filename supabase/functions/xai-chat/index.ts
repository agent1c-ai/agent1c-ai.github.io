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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  }
}

function utcDay(){
  return new Date().toISOString().slice(0, 10)
}

function estimateTokensFromText(text: string){
  const chars = String(text || "").length
  return Math.max(1, Math.ceil(chars / 3))
}

function estimateInputTokens(messages: Array<{ role?: string; content?: string }>, model: string){
  const body = JSON.stringify(messages || [])
  const modelOverhead = Math.max(8, Math.ceil(String(model || "").length / 2))
  return estimateTokensFromText(body) + modelOverhead + 32
}

function estimateOutputTokens(replyText: string, providerOutputTokens: number){
  const estimatedFromText = estimateTokensFromText(replyText) + 16
  const provider = Math.max(0, Number(providerOutputTokens || 0))
  return Math.max(estimatedFromText, provider)
}

async function getTodayUsage(adminClient: ReturnType<typeof createClient>, userId: string, day: string){
  const { data, error } = await adminClient
    .from("daily_token_usage")
    .select("input_tokens,output_tokens")
    .eq("user_id", userId)
    .eq("usage_date", day)
    .maybeSingle()
  if (error) throw new Error(`usage_read_failed:${error.message}`)
  const input = Math.max(0, Number(data?.input_tokens || 0))
  const output = Math.max(0, Number(data?.output_tokens || 0))
  return { input, output, used: input + output }
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

  const body = await req.json().catch(() => ({}))
  const model = String(body?.model || "grok-4-latest")
  const temperature = Number(body?.temperature ?? 0.4)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const xaiApiKey = Deno.env.get("XAI_API_KEY") ?? ""
  if (!xaiApiKey) {
    return new Response(JSON.stringify({ error: "Missing XAI_API_KEY" }), { status: 500, headers })
  }
  const day = utcDay()
  const inputEstimate = estimateInputTokens(messages, model)
  const usageBefore = await getTodayUsage(adminClient, user.id, day).catch(() => null)
  if (usageBefore && (usageBefore.used + inputEstimate > DAILY_TOKEN_LIMIT)) {
    const remaining = Math.max(0, DAILY_TOKEN_LIMIT - usageBefore.used)
    return new Response(JSON.stringify({
      error: {
        code: "LIMIT_REACHED",
        message: "Daily token limit reached.",
        limit: DAILY_TOKEN_LIMIT,
        used: usageBefore.used,
        remaining,
      },
    }), { status: 429, headers })
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
  if (xaiRes.ok) {
    const outputText = String(responseJson?.choices?.[0]?.message?.content || "")
    const providerIn = Math.max(0, Number(responseJson?.usage?.prompt_tokens || 0))
    const providerOut = Math.max(0, Number(responseJson?.usage?.completion_tokens || 0))
    const inputToCount = Math.max(inputEstimate, providerIn)
    const outputToCount = estimateOutputTokens(outputText, providerOut)
    const bump = await adminClient.rpc("bump_daily_token_usage", {
      p_user_id: user.id,
      p_usage_date: day,
      p_input_tokens: inputToCount,
      p_output_tokens: outputToCount,
    }).catch(() => ({ data: null, error: null }))
    const used = Math.max(
      0,
      Number(bump?.data?.input_tokens || usageBefore?.input || 0) +
      Number(bump?.data?.output_tokens || usageBefore?.output || 0),
    )
    responseJson.agent1c_usage = {
      used,
      limit: DAILY_TOKEN_LIMIT,
      remaining: Math.max(0, DAILY_TOKEN_LIMIT - used),
      day,
      counted_input_tokens: inputToCount,
      counted_output_tokens: outputToCount,
    }
  }

  return new Response(JSON.stringify(responseJson), {
    status: xaiRes.status,
    headers,
  })
})
