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
    "Cache-Control": "no-store",
  }
}

async function sendTelegramMessage(token: string, chatId: number | string, text: string){
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text || "").slice(0, 3900),
    }),
  })
  if (!response.ok) {
    const raw = await response.text().catch(() => "")
    throw new Error(`telegram_send_failed_${response.status}:${raw.slice(0, 220)}`)
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const botToken = String(Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim()
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !botToken) {
    return new Response(JSON.stringify({ error: "Supabase/Telegram environment missing" }), { status: 500, headers })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers })
  }

  const body = await req.json().catch(() => null) as {
    inbox_id?: number
    inbox_ids?: number[]
    telegram_chat_id?: number
    reply_text?: string
    mark_delivered_only?: boolean
  } | null
  const markDeliveredOnly = Boolean(body?.mark_delivered_only)
  if (!body || !body.telegram_chat_id || (!markDeliveredOnly && !body.reply_text)) {
    return new Response(JSON.stringify({ error: "Missing telegram_chat_id/reply_text" }), { status: 400, headers })
  }

  const link = await adminClient
    .from("telegram_links")
    .select("telegram_chat_id,status")
    .eq("user_id", user.id)
    .eq("status", "linked")
    .maybeSingle()

  if (link.error || !link.data?.telegram_chat_id) {
    return new Response(JSON.stringify({ error: "Not linked" }), { status: 403, headers })
  }

  if (Number(link.data.telegram_chat_id) !== Number(body.telegram_chat_id)) {
    return new Response(JSON.stringify({ error: "Chat mismatch" }), { status: 403, headers })
  }

  if (!markDeliveredOnly) {
    try {
      await sendTelegramMessage(botToken, body.telegram_chat_id, body.reply_text)
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "telegram_send_failed" }), { status: 502, headers })
    }
  }

  const inboxIds = Array.isArray(body.inbox_ids)
    ? body.inbox_ids.map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
    : []
  if (Number(body.inbox_id) > 0) inboxIds.push(Number(body.inbox_id))
  const uniqueInboxIds = Array.from(new Set(inboxIds))

  if (uniqueInboxIds.length) {
    await adminClient
      .from("telegram_inbox")
      .update({
        delivered_at: new Date().toISOString(),
        reply_text: String(body.reply_text || "").slice(0, 3900),
      })
      .in("id", uniqueInboxIds)
      .eq("user_id", user.id)
      .is("delivered_at", null)
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
})
