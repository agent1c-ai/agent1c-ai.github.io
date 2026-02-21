For implementation details, architecture plans, and working notes, see:
`../agent1carchitecture/`

Supabase auth/xAI operational guard checklist:
`supabase/OPERATIONS_CHECKLIST.md`

SUPABASE HARD GUARD (Agent1c project: `gkfhxhrleuauhnuewfmw`):
- For every single Supabase edit, verify `xai-chat` function setting `Verify JWT with legacy secret` is OFF.
- There is no valid condition in this project for that setting to be ON.
- If it is ON for any reason, turn it OFF immediately.

TOKEN ACCOUNTING RULE (Agent1c.ai cloud):
- Never use xAI-side usage as the source of truth for per-user limits.
- Reason: xAI usage is provider/account-level and cannot enforce Agent1c per-user daily quotas.
- Per-user daily accounting must be implemented in Supabase (server-side), via creating or editing Edge Functions.
- For quota math, exact precision is not required; prefer conservative overcounting (never undercount).
- Rollover bug guard:
  - If credits fail to reset at boundary and `429 LIMIT_REACHED` persists, treat this as backend bucket-state issue first.
  - Verify bucket key + bucket start logic in `supabase/functions/xai-chat/index.ts`.
  - Ensure stale rows are neutralized (rows with `updated_at` older than active bucket start must not count toward current day).
  - Validate with temporary near-future UTC boundary only for test, then keep/reset logic explicit.

Execution behavior:
- When user requests a full revert, perform a full revert of the failed pass.
- Preserve documentation updates unless user explicitly asks to revert docs too.
- Validate chat end-to-end after backend changes before considering the pass complete.

Production implementation rule:
- If you find a kludge in code, explicitly highlight it before extending that area.
- If the requested feature depends on that kludge, first propose and execute the kludge cleanup path, then implement the new feature on top of the cleaned path.

PROJECT NAMING HARD RULE:
- Canonical project domains are ONLY:
  - `agent1c.ai`
  - `agent1c.me`
- Never write or introduce `agentic.*` in code, configs, scripts, docs, CORS lists, or defaults.
- If any `agentic.*` reference is found anywhere in this codebase, surface it to the user immediately and propose cleanup.

TELEGRAM CLOUD RELAY MODEL (Agent1c.ai, tab-online only):
- Product constraint:
  - Telegram replies are allowed only while the user's linked Agent1c.ai browser tab is online.
  - Backend is relay/security only (Telegram token + routing), not LLM runtime, and not doc/context storage.
- Core split:
  - Backend (Supabase): receives Telegram webhooks, verifies link ownership, forwards inbound messages to active tab, posts outbound replies back to Telegram.
  - Frontend tab: keeps SOUL/TOOLS/heartbeat/context locally, runs LLM, composes Telegram replies.

Telegram Connect window (must exist in Agent1c.ai UI):
- Window title: `Telegram`.
- Purpose text: connect your Telegram account to Hitomi (@HitomiTalbot).
- States:
  - `Not linked`
  - `Link code ready`
  - `Linked as @username`
  - `Waiting for tab` / `Offline`
- Required controls:
  - `Generate Code` button (requests one-time `/start <code>` payload from backend).
  - `Open Telegram` button/link that opens:
    - `https://t.me/HitomiTalbot?start=<code>`
    - (Telegram converts this to `/start <code>` automatically)
  - Read-only code display + copy button.
  - Link status line.
  - `Unlink` button.
- UX requirement:
  - User should not need to manually type `/start`.
  - The open link must directly launch DM with bot and carry the start payload.

Linking and routing:
- `telegram-link-init` (auth required):
  - Creates short-lived, one-time start code tied to authenticated user id.
  - Returns deep link + expiry.
- `telegram-webhook` (bot ingress, secret-verified):
  - On `/start <code>`: validate code, bind `telegram_user_id -> app_user_id`.
  - On normal DM: route to currently active browser session for that linked app user.
- `telegram-link-status` (auth required):
  - Returns linked state, username, and whether an active browser session is online.

Online session requirement:
- Browser keeps an authenticated live channel/session heartbeat to relay.
- Relay routes Telegram DMs only to active session(s) of linked user.
- If no live tab session: bot sends offline notice (open Agent1c.ai tab to continue).
- Session lease timeout must be explicit (e.g. 20-30s).

Security constraints:
- Telegram bot token lives only in Supabase secrets.
- Webhook requests validated with Telegram secret header/token.
- Never trust Telegram username for identity; use immutable `telegram_user_id`.
- Enforce DM-only behavior (ignore groups/channels unless explicitly added later).

Implementation gaps checklist (must resolve before coding):
- Define active-session arbitration if multiple tabs are online:
  - newest session wins, or
  - explicit primary tab election.
- Define request/response timeout behavior for Telegram:
  - If tab doesn't answer in time, send graceful fallback message.
- Define ordering guarantees:
  - Preserve per-chat message order when forwarding to browser.
- Define rate limits:
  - Per-telegram-user and per-app-user throttles to prevent abuse loops.
- Define unlink semantics:
  - Unlink from app UI and optional unlink command from Telegram DM.
- Define observability:
  - Event logging for code generation, link success/failure, route failures, timeout responses.
