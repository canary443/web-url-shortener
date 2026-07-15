-- private signup metadata for short-lived abuse investigation
create table if not exists public.signup_events (
  id bigint generated always as identity primary key,
  ip_address inet not null,
  email_fingerprint text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_events_ip_created_idx
  on public.signup_events (ip_address, created_at desc);

create index if not exists signup_events_email_created_idx
  on public.signup_events (email_fingerprint, created_at desc);

alter table public.signup_events enable row level security;
revoke all on table public.signup_events from public, anon, authenticated;

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
  delete from signup_events where created_at < now() - interval '30 days';
$$;

revoke execute on function public.cleanup_expired() from public, anon, authenticated;
