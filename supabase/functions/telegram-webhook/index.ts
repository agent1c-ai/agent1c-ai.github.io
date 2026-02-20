import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function json(data: unknown, status = 200){
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

async function sendTelegramMessage(token: string, chatId: number | string, text: string){
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text || "").slice(0, 3900),
    }),
  })
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const secretHeader = String(req.headers.get("x-telegram-bot-api-secret-token") || "").trim()
  const expectedSecret = String(Deno.env.get("TELEGRAM_WEBHOOK_SECRET_TOKEN") || "").trim()
  if (!expectedSecret || secretHeader !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const botToken = String(Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim()
  if (!supabaseUrl || !serviceRoleKey || !botToken) {
    return json({ error: "Supabase/Telegram environment missing" }, 500)
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const update = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!update) return json({ ok: true, ignored: true, reason: "bad_json" })
  const message = (update.message || update.edited_message) as Record<string, unknown> | undefined
  if (!message) return json({ ok: true, ignored: true, reason: "no_message" })

  const chat = (message.chat || {}) as Record<string, unknown>
  const from = (message.from || {}) as Record<string, unknown>
  const chatType = String(chat.type || "")
  const chatId = Number(chat.id || 0)
  const text = String(message.text || "").trim()
  const telegramUserId = Number(from.id || 0)
  const messageId = Number(message.message_id || 0)

  if (!chatId || !telegramUserId) return json({ ok: true, ignored: true, reason: "missing_ids" })
  if (chatType !== "private") return json({ ok: true, ignored: true, reason: "non_private_chat" })

  const startMatch = /^\/start(?:\s+(.+))?$/i.exec(text)
  if (startMatch) {
    const startCode = String(startMatch[1] || "").trim()
    if (!startCode) {
      await sendTelegramMessage(botToken, chatId, "Open Agent1c.ai and press Telegram → Generate Code, then use that link here.")
      return json({ ok: true, linked: false, reason: "missing_start_code" })
    }
    const nowIso = new Date().toISOString()
    const challengeRes = await adminClient
      .from("telegram_link_challenges")
      .select("id,user_id,expires_at,used_at")
      .eq("start_code", startCode)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (challengeRes.error || !challengeRes.data?.user_id) {
      await sendTelegramMessage(botToken, chatId, "That connect code is invalid or expired. Please generate a new one from Agent1c.ai.")
      return json({ ok: true, linked: false, reason: "invalid_or_expired_code" })
    }
    const userId = String(challengeRes.data.user_id)

    const existingByTg = await adminClient
      .from("telegram_links")
      .select("user_id")
      .eq("telegram_user_id", telegramUserId)
      .eq("status", "linked")
      .maybeSingle()
    if (existingByTg.data?.user_id && String(existingByTg.data.user_id) !== userId) {
      await sendTelegramMessage(botToken, chatId, "This Telegram account is already linked to another Agent1c account.")
      return json({ ok: true, linked: false, reason: "already_linked_elsewhere" })
    }

    const username = String(from.username || "")
    const firstName = String(from.first_name || "")
    const lastName = String(from.last_name || "")
    const upsertRes = await adminClient
      .from("telegram_links")
      .upsert({
        user_id: userId,
        telegram_user_id: telegramUserId,
        telegram_chat_id: chatId,
        telegram_username: username,
        telegram_first_name: firstName,
        telegram_last_name: lastName,
        status: "linked",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
    if (upsertRes.error) {
      await sendTelegramMessage(botToken, chatId, "Could not link right now. Please try again.")
      return json({ ok: true, linked: false, reason: "link_upsert_failed" })
    }

    await adminClient
      .from("telegram_link_challenges")
      .update({ used_at: new Date().toISOString() })
      .eq("id", challengeRes.data.id)

    await sendTelegramMessage(botToken, chatId, "Linked! Keep your Agent1c.ai tab open and message me here anytime.")
    return json({ ok: true, linked: true, user_id: userId })
  }

  const linkRes = await adminClient
    .from("telegram_links")
    .select("user_id,status")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "linked")
    .maybeSingle()
  if (linkRes.error || !linkRes.data?.user_id) {
    await sendTelegramMessage(botToken, chatId, "I could not find a linked Agent1c account for this Telegram. Open Agent1c.ai → Telegram and connect first.")
    return json({ ok: true, queued: false, reason: "not_linked" })
  }

  const existingMsg = await adminClient
    .from("telegram_inbox")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .eq("telegram_message_id", messageId)
    .maybeSingle()
  if (existingMsg.data?.id) return json({ ok: true, queued: true, duplicate: true })

  const insertRes = await adminClient.from("telegram_inbox").insert({
    user_id: linkRes.data.user_id,
    telegram_user_id: telegramUserId,
    telegram_chat_id: chatId,
    telegram_message_id: messageId || null,
    telegram_username: String(from.username || ""),
    telegram_first_name: String(from.first_name || ""),
    message_text: text || "",
    raw_update: update,
  })
  if (insertRes.error) {
    return json({ ok: false, queued: false, error: `queue_insert_failed:${insertRes.error.message}` }, 500)
  }

  return json({ ok: true, queued: true })
})
