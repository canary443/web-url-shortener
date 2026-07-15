-- authenticated links now expire after 31 days
update public.links
set expires_at = created_at + interval '31 days'
where user_id is not null and expires_at is null;

-- anonymous links never expose or collect click statistics
update public.links set clicks = 0 where user_id is null and clicks <> 0;

create or replace function public.increment_clicks(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update links
  set clicks = clicks + 1
  where code = p_code and user_id is not null;
$$;

-- private activity log used by the daily keepalive job
create table if not exists public.keepalive_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

alter table public.keepalive_events enable row level security;
revoke all on table public.keepalive_events from public, anon, authenticated;

-- per-user api activity, read by the dashboard through the backend only
create table if not exists public.api_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  code text,
  created_at timestamptz not null default now()
);

create index if not exists api_events_user_created_idx
  on public.api_events (user_id, created_at desc);

alter table public.api_events enable row level security;
revoke all on table public.api_events from public, anon, authenticated;

create or replace function public.cleanup_expired()
returns void
language sql
security definer
set search_path = public
as $$
  delete from links where expires_at is not null and expires_at < now();
  delete from rate_limits where window_start < now() - interval '1 day';
  delete from keepalive_events where created_at < now() - interval '400 days';
  delete from api_events where created_at < now() - interval '30 days';
$$;

revoke execute on function public.increment_clicks(text) from public, anon, authenticated;
revoke execute on function public.cleanup_expired() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule(
  'lynka-daily-keepalive',
  '0 7 * * *',
  $$insert into public.keepalive_events default values$$
);
