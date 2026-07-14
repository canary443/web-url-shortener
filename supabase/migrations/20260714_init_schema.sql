-- links table
create table public.links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  target_url text not null,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  clicks bigint not null default 0
);

create index links_user_id_idx on public.links (user_id);
create index links_expires_at_idx on public.links (expires_at) where expires_at is not null;

alter table public.links enable row level security;

-- users read and delete their own links, all writes go through the backend
create policy "users read own links" on public.links
  for select using ((select auth.uid()) = user_id);

create policy "users delete own links" on public.links
  for delete using ((select auth.uid()) = user_id);

-- fixed-window rate limit counters, service role only
create table public.rate_limits (
  key text not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, action, window_start)
);

alter table public.rate_limits enable row level security;

-- atomic rate limit check, returns true while under the limit
create or replace function public.check_rate_limit(
  p_key text,
  p_action text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits as rl (key, action, window_start, count)
  values (p_key, p_action, v_window_start, 1)
  on conflict (key, action, window_start)
  do update set count = rl.count + 1
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- click counter, called after each redirect
create or replace function public.increment_clicks(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update links set clicks = clicks + 1 where code = p_code;
$$;

-- removes expired links and stale rate limit windows
create or replace function public.cleanup_expired()
returns void
language sql
security definer
set search_path = public
as $$
  delete from links where expires_at is not null and expires_at < now();
  delete from rate_limits where window_start < now() - interval '1 day';
$$;

-- these functions are for the backend only
revoke execute on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;
revoke execute on function public.increment_clicks(text) from public, anon, authenticated;
revoke execute on function public.cleanup_expired() from public, anon, authenticated;
