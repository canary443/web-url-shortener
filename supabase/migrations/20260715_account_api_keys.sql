-- one private api key per account, only hashes are stored
create table if not exists public.api_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  rpm int not null default 5 check (rpm between 1 and 10000),
  link_ttl_seconds int not null default 2678400 check (link_ttl_seconds between 60 and 31536000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
revoke all on table public.api_keys from public, anon, authenticated;

create or replace function public.touch_api_key_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists api_keys_touch_updated_at on public.api_keys;
create trigger api_keys_touch_updated_at
before update on public.api_keys
for each row execute function public.touch_api_key_updated_at();

revoke execute on function public.touch_api_key_updated_at() from public, anon, authenticated;
