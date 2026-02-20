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

Execution behavior:
- When user requests a full revert, perform a full revert of the failed pass.
- Preserve documentation updates unless user explicitly asks to revert docs too.
- Validate chat end-to-end after backend changes before considering the pass complete.

Production implementation rule:
- If you find a kludge in code, explicitly highlight it before extending that area.
- If the requested feature depends on that kludge, first propose and execute the kludge cleanup path, then implement the new feature on top of the cleaned path.
