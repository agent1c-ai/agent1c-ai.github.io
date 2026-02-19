create table if not exists public.daily_token_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.daily_token_usage enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_token_usage'
      and policyname = 'users_can_read_own_daily_usage'
  ) then
    create policy users_can_read_own_daily_usage
      on public.daily_token_usage
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.increment_daily_token_usage(
  p_user_id uuid,
  p_usage_date date,
  p_input_tokens bigint,
  p_output_tokens bigint
)
returns table (
  user_id uuid,
  usage_date date,
  input_tokens bigint,
  output_tokens bigint
)
language sql
security definer
set search_path = public
as $$
  insert into public.daily_token_usage as d (user_id, usage_date, input_tokens, output_tokens, updated_at)
  values (
    p_user_id,
    p_usage_date,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    now()
  )
  on conflict (user_id, usage_date)
  do update set
    input_tokens = d.input_tokens + greatest(coalesce(excluded.input_tokens, 0), 0),
    output_tokens = d.output_tokens + greatest(coalesce(excluded.output_tokens, 0), 0),
    updated_at = now()
  returning d.user_id, d.usage_date, d.input_tokens, d.output_tokens;
$$;

revoke all on function public.increment_daily_token_usage(uuid, date, bigint, bigint) from public;
grant execute on function public.increment_daily_token_usage(uuid, date, bigint, bigint) to service_role;
