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
- Reuse or extend existing function(s) such as `xai-usage` if appropriate, but keep enforcement in Supabase.
- For quota math, exact precision is not required; prefer conservative overcounting (never undercount).

WHEN USER TELLS YOU TO DO SOMETHING, YOU DO IT WITHOUT QUESTION.
WHEN USER TELLS YOU TO REVERT, YOU REVERT IN ENTIRETY, NOT PICK AND CHOOSE WHAT YOU FEEL OR THINK YOU CAN REVERT TO FIX THE PROBLEM YOU HAVE CAUSED.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
REVERT MEANS REVERT.
