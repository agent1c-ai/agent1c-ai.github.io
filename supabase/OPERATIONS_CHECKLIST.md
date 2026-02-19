# Supabase Ops Checklist (Auth + xai-chat)

Use this before and after any auth/function change on `agent1c.ai`.

## Invariants (Must Stay True)

1. Edge Function `xai-chat`:
   - `Verify JWT with legacy secret` = `OFF`
2. Frontend auth flow:
   - OAuth launches by same-tab redirect (`window.location.assign(...)`)
   - No extra popup/new-tab auth logic
3. Frontend token source:
   - Uses only current project key in local storage:
   - `sb-gkfhxhrleuauhnuewfmw-auth-token`

## Pre-Deploy Checklist

1. Confirm Supabase project ref:
   - `gkfhxhrleuauhnuewfmw`
2. Confirm function settings in dashboard:
   - `xai-chat` exists and is active
   - `Verify JWT with legacy secret` is OFF
3. Confirm secrets:
   - `XAI_API_KEY` is set

## Post-Deploy Smoke Test

1. Browser login test:
   - Sign in with Google or X on `https://agent1c.ai`
   - Ensure no extra blank auth tab appears
2. Chat test:
   - Send one message in Chat 1
   - Expect assistant reply (not `401`)
3. Supabase invocation test:
   - `OPTIONS` should be `200`
   - `POST` should be `200` for logged-in requests

## If 401 Appears

1. First check dashboard:
   - `xai-chat` -> `Verify JWT with legacy secret` must be OFF
2. Re-test login and one chat request.
3. If still failing, re-deploy known-good function code and re-test.

## Rollback Rule

If a regression is introduced, do a full rollback to last known-good auth/chat commit and function deploy.
No partial cherry-picks during incident recovery.
