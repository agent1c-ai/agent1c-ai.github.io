create table if not exists public.android_auth_handoffs (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_type text not null default 'bearer',
  expires_in integer not null default 3600,
  user_email text,
  provider text,
  user_handle text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists android_auth_handoffs_user_id_idx
  on public.android_auth_handoffs (user_id);

create index if not exists android_auth_handoffs_expires_at_idx
  on public.android_auth_handoffs (expires_at);

alter table public.android_auth_handoffs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'android_auth_handoffs'
      and policyname = 'android_auth_handoffs_no_direct_access'
  ) then
    create policy android_auth_handoffs_no_direct_access
      on public.android_auth_handoffs
      for all
      using (false)
      with check (false);
  end if;
end $$;

