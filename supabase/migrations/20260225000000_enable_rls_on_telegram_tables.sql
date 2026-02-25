-- Security hardening: Telegram relay tables are accessed via Supabase Edge Functions
-- using the service-role key. They should not be directly readable/writable via
-- PostgREST from anon/authenticated clients.
alter table public.telegram_link_challenges enable row level security;
alter table public.telegram_links enable row level security;
alter table public.telegram_inbox enable row level security;

