-- Friends + server-validated virtual currency transfers (no client-side balance edits for other users).
-- Uses auth.users for FKs (matches player_profiles.user_id pattern in this app).

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_no_self check (sender_id <> receiver_id),
  unique (sender_id, receiver_id)
);

create index if not exists friend_requests_receiver_pending_idx
  on public.friend_requests (receiver_id)
  where status = 'pending';

create index if not exists friend_requests_sender_idx
  on public.friend_requests (sender_id);

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_select_participants" on public.friend_requests;
create policy "friend_requests_select_participants"
  on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "friend_requests_insert_as_sender" on public.friend_requests;
create policy "friend_requests_insert_as_sender"
  on public.friend_requests for insert
  with check (
    auth.uid() = sender_id
    and status = 'pending'
  );

drop policy if exists "friend_requests_update_receiver" on public.friend_requests;
create policy "friend_requests_update_receiver"
  on public.friend_requests for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

drop policy if exists "friend_requests_delete_participants" on public.friend_requests;
create policy "friend_requests_delete_participants"
  on public.friend_requests for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create table if not exists public.player_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  created_at timestamptz not null default now(),
  constraint player_transfers_no_self check (sender_id <> receiver_id)
);

create index if not exists player_transfers_sender_created_idx
  on public.player_transfers (sender_id, created_at desc);

create index if not exists player_transfers_receiver_created_idx
  on public.player_transfers (receiver_id, created_at desc);

alter table public.player_transfers enable row level security;

drop policy if exists "player_transfers_select_involved" on public.player_transfers;
create policy "player_transfers_select_involved"
  on public.player_transfers for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- No insert/update/delete for authenticated on player_transfers (RPC only, SECURITY DEFINER).

comment on table public.friend_requests is 'Social friend requests; status pending|accepted|declined.';
comment on table public.player_transfers is 'Virtual balance transfers; rows inserted only by transfer_to_friend RPC.';

-- Atomic transfer: validates friendship, balance, debt, limits; updates both player_profiles.profile JSON balances.
create or replace function public.transfer_to_friend(p_receiver_id uuid, p_amount numeric)
returns table(success boolean, message text, new_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_rec uuid := p_receiver_id;
  s_prof jsonb;
  r_prof jsonb;
  s_bal numeric;
  r_bal numeric;
  debt numeric;
  daily_sum numeric;
  v_max_tx constant numeric := 10000;
  v_daily_limit constant numeric := 50000;
  v_start timestamptz := date_trunc('day', timezone('utc', now()));
begin
  if v_sender is null then
    return query select false, 'Not authenticated'::text, 0::numeric;
    return;
  end if;
  if v_rec is null or v_rec = v_sender then
    return query select false, 'Invalid recipient'::text, 0::numeric;
    return;
  end if;
  if p_amount is null or p_amount < 1 then
    return query select false, 'Minimum transfer is $1'::text, 0::numeric;
    return;
  end if;
  if p_amount > v_max_tx then
    return query select false, 'Exceeds per-transaction limit ($10,000)'::text, 0::numeric;
    return;
  end if;

  if not exists (
    select 1
    from public.friend_requests fr
    where fr.status = 'accepted'
      and (
        (fr.sender_id = v_sender and fr.receiver_id = v_rec)
        or (fr.sender_id = v_rec and fr.receiver_id = v_sender)
      )
  ) then
    return query select false, 'You can only send to accepted friends'::text, 0::numeric;
    return;
  end if;

  select coalesce(sum(t.amount), 0) into daily_sum
  from public.player_transfers t
  where t.sender_id = v_sender
    and t.status = 'completed'
    and t.created_at >= v_start;

  if daily_sum + p_amount > v_daily_limit then
    return query select false, 'Daily send limit exceeded ($50,000)'::text, 0::numeric;
    return;
  end if;

  perform 1
  from public.player_profiles
  where user_id = least(v_sender, v_rec)
  for update;

  perform 1
  from public.player_profiles
  where user_id = greatest(v_sender, v_rec)
  for update;

  select p.profile into s_prof from public.player_profiles p where p.user_id = v_sender;
  select p.profile into r_prof from public.player_profiles p where p.user_id = v_rec;

  if s_prof is null then
    return query select false, 'Sender profile missing'::text, 0::numeric;
    return;
  end if;
  if r_prof is null then
    return query select false, 'Recipient has no game profile yet'::text, 0::numeric;
    return;
  end if;

  begin
    debt := coalesce((s_prof #>> '{playerRecoveryState,totalDebtRemaining}')::numeric, 0);
  exception when others then
    debt := 0;
  end;
  if debt > 0 then
    return query select false, 'Cannot send while you have unpaid debt'::text, 0::numeric;
    return;
  end if;

  begin
    s_bal := coalesce((s_prof ->> 'balance')::numeric, 0);
  exception when others then
    s_bal := 0;
  end;
  begin
    r_bal := coalesce((r_prof ->> 'balance')::numeric, 0);
  exception when others then
    r_bal := 0;
  end;

  if s_bal < p_amount then
    return query select false, 'Insufficient balance'::text, s_bal;
    return;
  end if;

  s_prof := jsonb_set(s_prof, '{balance}', to_jsonb(s_bal - p_amount), true);
  r_prof := jsonb_set(r_prof, '{balance}', to_jsonb(r_bal + p_amount), true);

  update public.player_profiles
  set profile = s_prof, updated_at = now()
  where user_id = v_sender;

  update public.player_profiles
  set profile = r_prof, updated_at = now()
  where user_id = v_rec;

  insert into public.player_transfers (sender_id, receiver_id, amount, status)
  values (v_sender, v_rec, p_amount, 'completed');

  return query select true, 'OK'::text, (s_bal - p_amount)::numeric;
end;
$$;

revoke all on function public.transfer_to_friend(uuid, numeric) from public;
grant execute on function public.transfer_to_friend(uuid, numeric) to authenticated;
