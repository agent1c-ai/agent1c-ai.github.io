For implementation details, architecture plans, and working notes, see:
`../agent1carchitecture/`

For the current Solana integration plan and recovery notes, see:
`SOLANA.md`

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
- Current exception note:
  - Some existing `agentic` wording is intentionally acceptable for now when it is descriptive rather than domain/brand naming.
  - Example: `Agentic Root` may remain as a product term for the root visible to the agent.
  - Do not treat existing descriptive `agentic` text as an immediate cleanup task unless the user asks for a terminology pass.
  - Still do not introduce new `agentic.*` domains, hostnames, config keys, or branded defaults.

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

WEB PROXY STATUS SNAPSHOT (Agent1c.ai)
- Existing feature:
  - Hedgey Browser route toggle (`🖧`, `🧅`, purple `🧅`) with Shell/Tor relay selection.
  - Shared `Use Experimental Web Proxy` toggle in Shell Relay and Tor Relay windows.
  - Relay proxy endpoints `/v1/proxy/page` and `/v1/proxy/asset`.
  - Proxy fallback mode in Hedgey Browser (experimental proxy ON).
  - Canonical proxied link navigation (browser URL stays real target URL).
  - Universal GET form-submit bridge (including scripted submit paths).
  - `srcset` + CSS `url(...)` / `@import` rewriting.
  - Recursive rewrite guards + canonical form-action unwrapping fixes.
- To be implemented for proxy browsing:
  - P2.2 anti-bot detection/warning on proxy path (single-fetch only; no browser-side preflight).
  - Proxy status/title UX polish after proxied navigation.
  - Saved-app proxy correctness hardening (always store original URL, reliable reopen).
  - Additional compatibility work (POST forms graceful handling, redirect edge cases).
  - Cloudflare Worker implementation of the same proxy contract for multi-user managed browsing.

# Refactor Plan (agent1c.js modularization)

## Current state snapshot (`agent1c.ai`)

- Main runtime file is large (`js/agent1c.js`, ~6.5k lines).
- The file currently mixes:
  - core local runtime state + persistence
  - cloud-managed auth/billing/credits integrations
  - provider runtime logic
  - tool/runtime orchestration
  - onboarding + Hitomi/clippy UI
  - relay/Tor relay windows
  - panel/window HTML factories + DOM wiring

## Observed module clusters in current `.ai` file

### 1. Core utilities + local persistence (candidate: `agent1c-core.js`)
- DOM helpers, formatting, safe parsing, IndexedDB wrappers, events store.
- Vault/meta/config/state persistence helpers exist even in `.ai` because local state/docs still matter.
- Includes crypto helpers used for local encrypted storage paths.

### 2. Cloud identity / credits / billing / hosted Telegram (candidate: `agent1c-cloud.js`) [AI-ONLY]
- Supabase config helpers (`getSupabaseConfig`, cloud function URL helpers).
- Cloud identity and usage refresh (`refreshCloudIdentity`, `refreshCloudCredits`).
- Credits checkout/Gumroad flow (`openCreditsCheckout*`).
- Cloud Telegram link state / code generation / inbox polling (`cloudTelegramRequest`, `refreshCloudTelegramLinkState`, `generateCloudTelegramLinkCode`, `pollCloudTelegramInbox`).
- Cloud-specific UI rendering hooks (`applyCloudIdentityToUi`, `applyCloudUsageToUi`, `updateCloudTelegramUi`).

### 3. Provider runtime + LLM calls (candidate: `agent1c-providers.js`)
- OpenAI / Anthropic / xAI / z.ai / Ollama adapters.
- Provider normalization, active runtime resolution, provider validation.
- Model listing and provider-specific key tests.
- This is partially shared between `.ai` and `.me`, but runtime key source differs.

### 4. Prompting / tools / tool-call loop (candidate: `agent1c-tools-runtime.js`)
- System prompt composition and cadence (`buildSystemPromptWithCadence`, SOUL reanchoring cadence).
- Tool parsing / tool arg parsing.
- Tool implementations (filesystem, wiki, GitHub, window actions, relay-shell, etc.).
- `providerChatWithTools(...)` orchestration loop.
- This should be highly shared, but cloud/local gating hooks may differ slightly.

### 5. Chat state + threads + Telegram thread bridge (candidate: `agent1c-chatstate.js`)
- Local thread lifecycle (`ensureLocalThreadsInitialized`, `createNewLocalThread`, etc.)
- Chat 1 / local thread semantics.
- Telegram thread mirroring (`ensureTelegramThread`, labels, routing support).
- Message pushing/thinking flags.

### 6. Filesystem watch + docs autosave + config autosave (candidate: `agent1c-docs-files.js`)
- Filesystem upload scan + notices
- SOUL/TOOLS/heartbeat autosave schedulers
- line-number + wrap-aware gutter helpers
- config/loop autosave timers

### 7. Hitomi / Clippy / onboarding hedgehog UI (candidate: `agent1c-hitomi-ui.js`)
- Clippy positioning, hopping, bubble layout, overlap snapping
- voice badge / push-to-talk hooks
- setup hedgehog rendering + chips + onboarding handoff
- Hitomi desktop icon and Persona folder helper calls
- This cluster exists in both repos but onboarding behavior differs significantly.

### 8. Main UI rendering + event toasts + panel badge refresh (candidate: `agent1c-ui.js`)
- `renderChat`, `renderEvents`, toast UI (`ensureEventToastUi`, `renderEventToasts`)
- `refreshUi`, `refreshBadges`, scaling, panel visibility
- browser relay state publication (`publishBrowserRelayState`)

### 9. Agent panels/windows wiring (candidate: `agent1c-panels.js`)
- `wire*WindowDom` and `open*Window` functions:
  - Ollama Setup
  - Shell Relay
  - Tor Relay
  - (plus panel open/restore helpers)
- panel HTML factory functions (`chatWindowHtml`, `configWindowHtml`, `toolsWindowHtml`, etc.)
- workspace construction (`createWorkspace`, `createSetupWindow`, `loadPersistentState`)

## `.ai`-specific divergence to preserve during refactor (do not force-share)

- Supabase login/auth callback handling
- Cloud credits/quota UI and billing buttons
- Hosted xAI managed provider path (no exposed BYOK vault UI)
- Cloud Telegram linking (backend relay + online tab model)
- Intro/login flow and managed-cloud onboarding windows
- No setup hedgehog provider/vault onboarding mode (different from `.me`)

## Shared-vs-divergent refactor strategy (recommended)

### Shared modules (same contract, separate copies first)
- `providers`
- `tools-runtime`
- `chatstate`
- `docs-files`
- portions of `hitomi-ui`
- relay panel wiring patterns

### Divergent modules (repo-specific)
- `.ai`: `cloud`, `auth`, `credits`, cloud Telegram link window + hosted provider runtime path
- `.me`: `vault/byok`, setup hedgehog onboarding completion logic, local Telegram polling flow

Important rule:
- First extract modules **within each repo** (mechanical split, no behavior changes).
- Only after both are stable, compare and optionally unify shared modules.
- Do not prematurely create a cross-repo shared library while both products are still diverging fast.

## Refactor sequencing (safe path)

1. Extract **pure utility + persistence** layer (lowest UI risk).
2. Extract **provider adapters** and validation functions.
3. Extract **tool-call parser + tool execution loop**.
4. Extract **chat/thread state**.
5. Extract **Hitomi/Clippy UI**.
6. Extract **panel HTML factories + panel wiring**.
7. Leave `agent1c.js` as orchestrator/bootstrap only.

## Success criteria

- `agent1c.js` becomes a thin bootstrap/composition layer.
- No behavior regressions in:
  - chat
  - relays
  - onboarding/login
  - credits
  - Telegram integration
- Existing global hooks used by `wm.js` / relay browser routing still work (or are replaced by stable exported bridges).
