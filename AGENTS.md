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

TOKEN/CHAT IMPLEMENTATION LOOP CONTRACT (MANDATORY):
1. Keep `xai-chat` request/response behavior unchanged for the frontend contract.
2. Add per-user daily usage tracking in Supabase only as a side-effect.
3. Never block chat on usage-write failures.
4. Enforce 12,000/day with conservative overcount.
5. Keep `Verify JWT with legacy secret` OFF.
6. Run end-to-end validation before pushing.
7. If end-to-end fails and cannot be fixed in the current pass, revert the entire project to the initial state and retry from step 1; keep documentation updates, and repeat until end-to-end succeeds.
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
