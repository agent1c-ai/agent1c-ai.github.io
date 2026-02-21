# Agent1c Chrome Extension Roadmap (Near-Future)

This roadmap describes the browser-extension path to enable true "browse with Hitomi" behavior that cannot be done reliably with iframe-only web constraints.

## Why Extension Mode

Web-only HedgeyOS browser is constrained by:

- X-Frame-Options / CSP frame-ancestors restrictions
- Anti-bot challenge pages
- Cross-origin script isolation
- No always-on-top overlay across arbitrary tabs

A Chrome extension can bridge these limits by running in the active page context and a controlled side panel.

## v1 Scope (Recommended)

1. Page Context Capture
- Read active tab URL/title
- Read selected text on demand
- Send compact page context to Agent1c runtime

2. Hitomi Side Panel
- Native extension side panel with Hitomi chat
- "Ask Hitomi about this page" action
- "Send selected text" action

3. Agent1c Tab Bridge
- Post page context into `agent1c.ai` tab session
- Keep auth/session in web app while extension supplies browse context

4. Lightweight Overlay (Optional in v1, default off)
- Tiny hedgehog helper marker on supported pages
- Click to open side panel

## v2 Scope

1. Action Intents
- Open links
- Extract structured snippets
- Fill small helper forms (with user confirmation)

2. Multi-tab Awareness
- Let Hitomi switch context between recent tabs
- User-approved tab list only

3. Guardrails
- Strict host permissions
- Per-action confirmation prompts
- Clear on-page indicator when automation runs

## Security / Privacy Principles

- Least-privilege host permissions
- Explicit opt-in for page reading and action execution
- No hidden background browsing
- Clear "what was sent" UX before sending context to LLM
- Configurable redaction for sensitive fields

## Technical Shape

- Extension Manifest V3
- Components:
  - service worker
  - content script (page bridge)
  - side panel UI
  - messaging bridge to `agent1c.ai`
- Keep provider calls in current cloud path (`xai-chat`) unless deliberately changed

## UX Goal

Make Hitomi feel like a real browsing companion:

- User browses normally
- Highlights text or presses "Ask Hitomi"
- Hitomi responds in-context in side panel
- Optional helper overlay for discoverability

