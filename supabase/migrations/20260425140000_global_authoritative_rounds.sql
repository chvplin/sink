-- Authoritative global crash rounds (server-driven loop via Edge Function + Realtime).
-- Clients read only; writes use service_role (Edge Function).

create table if not exists public.global_rounds (
  id uuid primary key default gen_random_uuid(),
  lobby_id text not null default 'global',
  round_seq bigint not null,
  status text not null check (status in ('countdown', 'active', 'crashed')),
  crash_point numeric(12, 2) not null,
  countdown_ends_at timestamptz not null,
  countdown_ms int not null default 10000,
  active_started_at timestamptz,
  crash_at timestamptz,
  crashed_at timestamptz,
  is_lucky_round boolean not null default false,
  growth_per_sec double precision not null default 0.05,
  start_rate_per_sec double precision not null default 0.45,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lobby_id, round_seq)
);

create index if not exists global_rounds_lobby_seq_desc
  on public.global_rounds (lobby_id, round_seq desc);

alter table public.global_rounds enable row level security;

drop policy if exists "global_rounds_select_all" on public.global_rounds;
create policy "global_rounds_select_all"
  on public.global_rounds for select
  using (true);

-- Optional: allow service role only for writes (bypasses RLS). No insert/update policies for authenticated.

comment on table public.global_rounds is 'Server-authoritative crash rounds; advanced by Edge Function global-game-tick.';

-- Server clock for client offset sync (ms since epoch).
create or replace function public.server_now_ms()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

grant execute on function public.server_now_ms() to anon, authenticated;

-- Realtime: enable in Dashboard if this migration line fails on your Postgres version:
-- alter publication supabase_realtime add table public.global_rounds;
do $$
begin
  alter publication supabase_realtime add table public.global_rounds;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
