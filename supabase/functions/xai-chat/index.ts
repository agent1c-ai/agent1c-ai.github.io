import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const DAILY_TOKEN_LIMIT = 12000
const APPROX_CHARS_PER_TOKEN = 4.2
// Temporary test boundary: reset daily usage at 02:01 UTC.
const RESET_HOUR_UTC = 2
const RESET_MINUTE_UTC = 1
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
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
  }
}

function utcDay(){
  const now = new Date()
  const shiftMs = (RESET_HOUR_UTC * 60 + RESET_MINUTE_UTC) * 60 * 1000
  return new Date(now.getTime() - shiftMs).toISOString().slice(0, 10)
}

function bucketStartMs(day: string){
  const shiftMs = (RESET_HOUR_UTC * 60 + RESET_MINUTE_UTC) * 60 * 1000
  return Date.parse(`${day}T00:00:00.000Z`) + shiftMs
}

function estimateTokensFromText(text: string){
  const chars = String(text || "").length
  return Math.max(1, Math.ceil(chars / APPROX_CHARS_PER_TOKEN))
}

function estimateInputTokens(messages: Array<{ role?: string; content?: string }>, model: string){
  const body = JSON.stringify(messages || [])
  const modelOverhead = Math.max(6, Math.ceil(String(model || "").length / 3))
  return estimateTokensFromText(body) + modelOverhead + 16
}

function estimateOutputTokens(replyText: string, providerOutputTokens: number){
  const estimatedFromText = estimateTokensFromText(replyText) + 16
  const provider = Math.max(0, Number(providerOutputTokens || 0))
  return Math.max(estimatedFromText, provider)
}

async function getTodayUsage(adminClient: ReturnType<typeof createClient>, userId: string, day: string){
  const { data, error } = await adminClient
    .from("daily_token_usage")
    .select("input_tokens,output_tokens,updated_at")
    .eq("user_id", userId)
    .eq("usage_date", day)
    .maybeSingle()
  if (error) throw new Error(`usage_read_failed:${error.message}`)
  const input = Math.max(0, Number(data?.input_tokens || 0))
  const output = Math.max(0, Number(data?.output_tokens || 0))
  const updatedAt = String(data?.updated_at || "")
  if (data && updatedAt) {
    const updatedAtMs = Date.parse(updatedAt)
    if (Number.isFinite(updatedAtMs) && updatedAtMs < bucketStartMs(day)) {
      return { input: 0, output: 0, used: 0, updatedAt }
    }
  }
  return { input, output, used: input + output, updatedAt }
}

async function bumpTodayUsage(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  day: string,
  inputToAdd: number,
  outputToAdd: number,
){
  const input = Math.max(0, Number(inputToAdd || 0))
  const output = Math.max(0, Number(outputToAdd || 0))
  if (!input && !output) {
    return await getTodayUsage(adminClient, userId, day)
  }
  const current = await getTodayUsage(adminClient, userId, day).catch(() => ({ input: 0, output: 0, used: 0 }))
  const nextInput = current.input + input
  const nextOutput = current.output + output
  const { error } = await adminClient
    .from("daily_token_usage")
    .upsert({
      user_id: userId,
      usage_date: day,
      input_tokens: nextInput,
      output_tokens: nextOutput,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,usage_date" })
  if (error) throw new Error(`usage_write_failed:${error.message}`)
  return { input: nextInput, output: nextOutput, used: nextInput + nextOutput, updatedAt: new Date().toISOString() }
}

serve(async (req) => {
  const headers = corsHeadersFor(req.headers.get("Origin"))
  if (req.method === "OPTIONS") return new Response("ok", { headers })

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
  const nowUtc = new Date().toISOString()
  if (req.method === "GET") {
    const usage = await getTodayUsage(adminClient, user.id, day).catch(() => ({ input: 0, output: 0, used: 0 }))
    return new Response(JSON.stringify({
      server_utc: nowUtc,
      day,
      limit: DAILY_TOKEN_LIMIT,
      used: usage.used,
      remaining: Math.max(0, DAILY_TOKEN_LIMIT - usage.used),
      input_tokens: usage.input,
      output_tokens: usage.output,
      last_updated_at: usage.updatedAt || null,
    }), { status: 200, headers })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers })
  }

  const body = await req.json().catch(() => ({}))
  const model = String(body?.model || "grok-4-latest")
  const temperature = Number(body?.temperature ?? 0.4)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const inputEstimate = estimateInputTokens(messages, model)
  const usageBefore = await getTodayUsage(adminClient, user.id, day).catch(() => null)
  if (usageBefore && usageBefore.used >= DAILY_TOKEN_LIMIT) {
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
  if (xaiRes.ok) {
    const outputText = String(responseJson?.choices?.[0]?.message?.content || "")
    const providerIn = Math.max(0, Number(responseJson?.usage?.prompt_tokens || 0))
    const providerOut = Math.max(0, Number(responseJson?.usage?.completion_tokens || 0))
    const inputToCount = Math.max(inputEstimate, providerIn)
    const outputToCount = estimateOutputTokens(outputText, providerOut)
    const usageAfter = await bumpTodayUsage(adminClient, user.id, day, inputToCount, outputToCount).catch(() => null)
    if (usageAfter) {
      responseJson.agent1c_usage = {
        day,
        server_utc: nowUtc,
        limit: DAILY_TOKEN_LIMIT,
        used: usageAfter.used,
        remaining: Math.max(0, DAILY_TOKEN_LIMIT - usageAfter.used),
        counted_input_tokens: inputToCount,
        counted_output_tokens: outputToCount,
        last_updated_at: usageAfter.updatedAt || null,
      }
    }
  }

  return new Response(JSON.stringify(responseJson), {
    status: xaiRes.status,
    headers,
  })
})
