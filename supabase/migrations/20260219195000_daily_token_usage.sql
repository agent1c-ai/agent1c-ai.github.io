create table if not exists public.daily_token_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.daily_token_usage enable row level security;

drop policy if exists "Users can read own usage rows" on public.daily_token_usage;
create policy "Users can read own usage rows"
on public.daily_token_usage
for select
using (auth.uid() = user_id);

create or replace function public.bump_daily_token_usage(
  p_user_id uuid,
  p_usage_date date,
  p_input_tokens integer,
  p_output_tokens integer
)
returns table (
  user_id uuid,
  usage_date date,
  input_tokens integer,
  output_tokens integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.daily_token_usage (user_id, usage_date, input_tokens, output_tokens, updated_at)
  values (
    p_user_id,
    p_usage_date,
    greatest(0, coalesce(p_input_tokens, 0)),
    greatest(0, coalesce(p_output_tokens, 0)),
    now()
  )
  on conflict (user_id, usage_date)
  do update set
    input_tokens = public.daily_token_usage.input_tokens + greatest(0, coalesce(p_input_tokens, 0)),
    output_tokens = public.daily_token_usage.output_tokens + greatest(0, coalesce(p_output_tokens, 0)),
    updated_at = now();

  return query
  select d.user_id, d.usage_date, d.input_tokens, d.output_tokens, d.updated_at
  from public.daily_token_usage d
  where d.user_id = p_user_id and d.usage_date = p_usage_date;
end;
$$;

revoke all on function public.bump_daily_token_usage(uuid, date, integer, integer) from public;
grant execute on function public.bump_daily_token_usage(uuid, date, integer, integer) to service_role;
