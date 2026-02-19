# Agent1c.ai vs Agent1c.me (Current Delta Map)

This document tracks the practical differences between:

- Cloud repo: `agent1c-ai.github.io` (`agent1c.ai`)
- Sovereign repo: `agent1c-me.github.io` (`agent1c.me`)

Goal: make refactor planning explicit and prevent accidental feature loss.

## 1) Product mode

- `agent1c.ai`: hosted/cloud-auth path (Supabase login + managed provider runtime).
- `agent1c.me`: sovereign local-first path (BYOK + local vault + no cloud auth dependency).

## 2) Onboarding

- `.ai`:
  - preload + intro path
  - cloud sign-in window (Google/X/magic link)
  - no vault requirement in cloud path
  - setup hedgehog continues after auth
- `.me`:
  - setup hedgehog + name capture
  - create vault / skip-for-now flow
  - provider onboarding around local key setup

## 3) AI provider model

- `.ai`:
  - managed cloud provider path via Supabase `xai-chat`
  - user does not manage provider key in main flow
  - credits window shown
- `.me`:
  - explicit multi-provider BYOK controls in UI
  - keys stored locally (vault or unencrypted skip mode)
  - no cloud credits meter

## 4) Security/storage model

- `.ai`:
  - session-driven cloud auth
  - cloud runtime and quota tracking
- `.me`:
  - local-only key storage and runtime intent
  - no mandatory account login

## 5) Agent windows and visibility

Both repos still include core agent panels in code (chat/config/soul/tools/heartbeat/events, etc.).

Important current divergence:

- Telegram implementation code is still present in `.ai` runtime.
- In `.ai` cloud workspace creation path, Telegram panel is not currently surfaced by default.
- In `.me`, Telegram API panel is part of normal workspace flow.

This is the main "inadvertently unshown" delta to resolve in upcoming refactor.

## 6) Relay surfaces

- `.ai`: shell relay window still exists in runtime, plus cloud relay direction.
- `.me`: shell relay + local-first relay setup remains central to sovereign flow.

## 7) Editable docs (SOUL/TOOLS/heartbeat)

- Both repos still expose editable markdown windows and runtime use.
- `.ai` currently overlays cloud-oriented system messages/events.
- `.me` remains the reference behavior for fully sovereign prompt/document control.

## 8) Known parity risks observed during fork drift

1. Telegram UI visibility drift in cloud workspace.
2. Intro/auth gating side effects obscuring expected windows.
3. Credits/auth changes accidentally impacting chat path.
4. Docs becoming inconsistent about which repo is source for which behavior.

## 9) Refactor guard

When porting features between repos:

1. Decide if feature is `.ai`-only, `.me`-only, or shared.
2. Update both this file and `../agent1c-me.github.io/LOCAL_VS_CLOUD_DIFF.md`.
3. Record whether differences are intentional product strategy or temporary drift.
