-- Piste: private application schema for Supabase/Postgres.
-- Apply this file once from Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  display_name text not null check (char_length(display_name) between 1 and 100),
  password_hash text not null check (password_hash like 'scrypt$%'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  user_agent_hash text not null check (char_length(user_agent_hash) = 64),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.login_attempts (
  identifier text primary key check (char_length(identifier) between 10 and 100),
  failures smallint not null default 0 check (failures between 0 and 10),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 2 and 100),
  location text not null default '' check (char_length(location) <= 80),
  zip text not null default '' check (zip = '' or zip ~ '^\d{4}$'),
  match_mode text not null check (match_mode in ('0', '1', '2', '3')),
  prospect_kind text not null check (prospect_kind in ('all', 'company', 'independent')),
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.saved_prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  fingerprint text not null check (char_length(fingerprint) = 64),
  prospect_data jsonb not null check (jsonb_typeof(prospect_data) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index if not exists auth_sessions_user_id_idx on public.auth_sessions(user_id);
create index if not exists auth_sessions_expires_at_idx on public.auth_sessions(expires_at);
create index if not exists prospect_searches_user_created_idx on public.prospect_searches(user_id, created_at desc);
create index if not exists saved_prospects_user_created_idx on public.saved_prospects(user_id, created_at desc);

alter table public.app_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.login_attempts enable row level security;
alter table public.prospect_searches enable row level security;
alter table public.saved_prospects enable row level security;

-- No browser role may access these tables. The server uses the service role only.
revoke all on table public.app_users from anon, authenticated;
revoke all on table public.auth_sessions from anon, authenticated;
revoke all on table public.login_attempts from anon, authenticated;
revoke all on table public.prospect_searches from anon, authenticated;
revoke all on table public.saved_prospects from anon, authenticated;
grant select, insert, update, delete on table public.app_users to service_role;
grant select, insert, update, delete on table public.auth_sessions to service_role;
grant select, insert, update, delete on table public.login_attempts to service_role;
grant select, insert, update, delete on table public.prospect_searches to service_role;
grant select, insert, update, delete on table public.saved_prospects to service_role;

create or replace function public.check_login_attempts(p_identifiers text[])
returns table(allowed boolean, attempts_remaining integer, locked_until timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  with relevant as (
    select
      failures,
      window_started_at,
      login_attempts.locked_until
    from public.login_attempts
    where identifier = any(p_identifiers)
  )
  select
    coalesce(bool_and(
      not (locked_until > now())
      and not (window_started_at > now() - interval '30 minutes' and failures >= 10)
    ), true) as allowed,
    coalesce(min(
      case when window_started_at <= now() - interval '30 minutes' then 10 else greatest(0, 10 - failures) end
    ), 10)::integer as attempts_remaining,
    max(case when locked_until > now() then locked_until end) as locked_until
  from relevant;
$$;

create or replace function public.record_login_failure(p_identifiers text[])
returns table(allowed boolean, attempts_remaining integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_identifier text;
begin
  foreach current_identifier in array p_identifiers loop
    if current_identifier is null or char_length(current_identifier) < 10 then
      continue;
    end if;

    insert into public.login_attempts(identifier, failures, window_started_at, locked_until, updated_at)
    values (current_identifier, 1, now(), null, now())
    on conflict (identifier) do update set
      failures = case
        when login_attempts.window_started_at <= now() - interval '30 minutes' then 1
        else least(10, login_attempts.failures + 1)
      end,
      window_started_at = case
        when login_attempts.window_started_at <= now() - interval '30 minutes' then now()
        else login_attempts.window_started_at
      end,
      locked_until = case
        when login_attempts.window_started_at <= now() - interval '30 minutes' then null
        when login_attempts.failures + 1 >= 10 then now() + interval '30 minutes'
        else login_attempts.locked_until
      end,
      updated_at = now();
  end loop;

  return query select * from public.check_login_attempts(p_identifiers);
end;
$$;

create or replace function public.clear_login_attempts(p_identifiers text[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.login_attempts where identifier = any(p_identifiers);
$$;

revoke all on function public.check_login_attempts(text[]) from public, anon, authenticated;
revoke all on function public.record_login_failure(text[]) from public, anon, authenticated;
revoke all on function public.clear_login_attempts(text[]) from public, anon, authenticated;
grant execute on function public.check_login_attempts(text[]) to service_role;
grant execute on function public.record_login_failure(text[]) to service_role;
grant execute on function public.clear_login_attempts(text[]) to service_role;

-- Keep the schema tidy. Schedule these statements daily with Supabase Cron if desired:
-- delete from public.auth_sessions where expires_at < now();
-- delete from public.login_attempts where updated_at < now() - interval '24 hours';
