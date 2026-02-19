# Agent1c.ai

Agent1c.ai is a hosted Agentic OS built on HedgeyOS. It runs as a web desktop with draggable windows, a persistent assistant persona (Hitomi), and cloud-authenticated chat runtime.

This repository is the `agent1c.ai` codebase (cloud mode path).  
`agent1c.me` (local-first BYOK path) is a separate repository.

## Product Modes

- `agent1c.ai` / `www.agent1c.ai`: intro window + cloud auth flow + cloud runtime.
- `app.agent1c.ai`: skips intro and enters cloud auth/runtime directly.
- `agent1c.me`: separate local-first product (not this repo).

## High-Level Architecture

## 1) Frontend Runtime (GitHub Pages)

- Pure static frontend (HTML/CSS/JS), no npm build pipeline.
- HedgeyOS-style desktop shell:
  - Menubar
  - Window manager
  - App launcher
  - Theme engine (default currently BeOS)
- Agent windows are top-level HedgeyOS windows, not nested panels.
- Hitomi hedgehog assistant exists as a floating desktop actor with dialog bubble modes.

Key modules:

- `js/main.js`: bootstraps shell + window manager + agent runtime.
- `js/wm.js`: core HedgeyOS window manager behavior.
- `js/agent1c.js`: agent app runtime wiring (chat, loops, events, windows, onboarding runtime).
- `js/agent1cauth.js`: cloud auth integration helpers.
- `js/agent1cintro.js`: intro/landing window logic.
- `js/agent1cpreload.js`: preload animation logic.
- `js/agent1crelay.js`: local relay integration logic (for shell/browser relay workflows).
- `js/voice-stt.js`: optional voice recognition controller.

## 2) Auth Layer (Supabase)

- Supabase Auth is the cloud gate for `.ai`.
- Supported sign-in methods:
  - Google OAuth
  - X OAuth
  - Magic link
- Frontend receives auth session and uses bearer token for managed cloud calls.

Supabase client config is injected in `index.html` via `window.__AGENT1C_SUPABASE_CONFIG`.

## 3) Managed AI Provider Path

- Cloud mode routes chat through Supabase Edge Function:
  - `POST /functions/v1/xai-chat`
- xAI API key is server-side only (never exposed to browser).
- Frontend treats provider as "Managed Cloud" in `.ai` runtime.

Function source in repo:

- `supabase/functions/xai-chat/index.ts`

Current behavior:

- Validates authenticated user via Supabase auth token.
- Proxies request to xAI chat completions.
- Returns provider response in OpenAI-style `choices[0].message.content` shape consumed by frontend.
- Includes conservative per-user token accounting metadata on successful responses (`agent1c_usage`) when available.

## 4) Credits and Quota

Cloud free plan target:

- 12,000 tokens per user per day (conservative overcount is acceptable).

Implementation principle:

- Accounting is per-user and server-side in Supabase.
- Never use provider-global usage as source of truth for per-user enforcement.
- Chat path must remain resilient:
  - usage write failures must not break chat response path.

UI:

- Credits window shows plan and remaining usage for the current day.
- Subscribe button currently exists as disabled "coming soon" CTA.

## 5) Agent Runtime Semantics

### Editable docs runtime

- `SOUL.md`: persona/system behavior layer.
- `TOOLS.md`: tool contract and invocation format.
- `heartbeat.md`: autonomous loop behavior prompt.

These docs are exposed as windows and are intended to affect live runtime behavior.

### Event-driven behavior

- Chat, loop ticks, and system events are written to Events window.
- Cloud mode includes login-driven prompts (welcome / return flow) and setup hedgehog guidance flow.

### Threading model

- Local chat supports multi-threading in UI.
- Cloud runtime currently uses managed provider path while preserving windowed UX.

## 6) Relay Surfaces

Two relay concepts exist in product design:

- Local shell relay (host-side setup, terminal-style controls, setup instructions).
- Browser CORS relay path (planned/iterative cloud relay behavior).

Shell relay setup UX is in dedicated window flows and docs (not tied to vault flow in cloud mode).

## 7) Intro + Onboarding Flow (Cloud)

Current cloud funnel:

1. Preload animation.
2. Intro window (for `agent1c.ai`, skipped on `app.agent1c.ai`).
3. User selects cloud path.
4. Auth window (Google/X/Magic link).
5. On successful auth:
   - Runtime windows open
   - Credits window visible
   - Hitomi setup flow continues in-cloud.

## 8) Supabase Operational Guardrails

Critical setting:

- In Supabase Edge Function `xai-chat`, `Verify JWT with legacy secret` must stay OFF.

Why:

- This project performs auth validation inside function logic against Supabase user session.
- Accidental JWT legacy verification enablement has repeatedly caused 401/runtime breakages.

## 9) Refactor Orientation

For upcoming refactor, use this repository as three logical layers:

1. Shell layer (HedgeyOS desktop/window manager/theme/input systems).
2. Agent runtime layer (Hitomi state machine + chat + loops + docs + events).
3. Cloud integration layer (auth/session/provider proxy/credits/quota).

Keep boundaries explicit:

- `wm.js` remains shell core.
- `agent1c.js` should orchestrate, not absorb every subsystem.
- Supabase functions should be stable contracts with minimal frontend branching.

## 10) Related Docs

Extended architecture and implementation planning docs are maintained in:

- `../agent1carchitecture/`

Important planning files there include:

- `AGENT1C_AI_CLOUD_ARCHITECTURE.md`
- `PHASE1_SUPABASE_AUTH_PLAN.md`
- `PHASE2_PLAN.md`
- `PHASE_ONBOARDING_HEDGEY_PLAN.md`
- `../agent1c-ai.github.io/CLOUD_VS_LOCAL_DIFF.md` (explicit `.ai` vs `.me` behavior map)

## 11) Deployment

- Static hosting: GitHub Pages.
- Custom domains: `agent1c.ai`, `www.agent1c.ai`, `app.agent1c.ai`.
- Supabase project ref for cloud runtime: `gkfhxhrleuauhnuewfmw`.
