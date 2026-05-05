-- DEF-108: Relationale Supabase Struktur (wallets + positions)
-- Migriert Legacy-Daten aus public.defi_manager_state.payload und entfernt danach die alte Blob-Tabelle.

begin;

create extension if not exists pgcrypto;

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  asset_name text not null,
  amount numeric not null default 0,
  value numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets(user_id);
create index if not exists wallets_name_idx on public.wallets(lower(name));
create index if not exists positions_wallet_id_idx on public.positions(wallet_id);
create index if not exists positions_created_at_idx on public.positions(created_at desc);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_positions_updated_at on public.positions;
create trigger set_positions_updated_at
before update on public.positions
for each row
execute function public.set_updated_at_timestamp();

-- Migration aus Legacy-Blob-Struktur (falls Tabelle existiert)
do $$
declare
  source_payload jsonb;
  source_updated_at timestamptz;
  default_wallet_id uuid;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'defi_manager_state'
  ) then
    select payload, updated_at
      into source_payload, source_updated_at
    from public.defi_manager_state
    where id = 'global'
    limit 1;

    if source_payload is not null then
      insert into public.wallets (name, created_at)
      select distinct
        trim(value #>> '{}') as name,
        coalesce(source_updated_at, now())
      from jsonb_array_elements(coalesce(source_payload->'wallets', '[]'::jsonb)) value
      where trim(value #>> '{}') <> ''
      on conflict do nothing;

      if not exists (select 1 from public.wallets) then
        insert into public.wallets (name) values ('Cash');
      end if;

      select id into default_wallet_id
      from public.wallets
      order by created_at asc
      limit 1;

      insert into public.positions (wallet_id, asset_name, amount, value, created_at, updated_at)
      select
        coalesce(w.id, default_wallet_id) as wallet_id,
        coalesce(nullif(trim(p->>'asset_name'), ''), nullif(trim(p->>'strategyName'), ''), nullif(trim(p->>'projectName'), ''), 'Unknown Asset') as asset_name,
        coalesce(nullif(p->>'investedAmount', '')::numeric, 0) as amount,
        coalesce(nullif(p->>'currentValue', '')::numeric, 0) as value,
        coalesce(nullif(p->>'date', '')::timestamptz, source_updated_at, now()) as created_at,
        coalesce(source_updated_at, now()) as updated_at
      from jsonb_array_elements(coalesce(source_payload->'positions', '[]'::jsonb)) p
      left join public.wallets w
        on lower(w.name) = lower(coalesce(nullif(trim(p->>'wallet'), ''), ''));
    end if;

    drop table if exists public.defi_manager_state cascade;
  end if;
end
$$;

alter table public.wallets enable row level security;
alter table public.positions enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.wallets to anon, authenticated;
grant select, insert, update, delete on public.positions to anon, authenticated;

-- RLS fuer aktuelle frontend-only Nutzung (anon)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets' and policyname = 'wallets_read_anon'
  ) then
    create policy wallets_read_anon on public.wallets
      for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets' and policyname = 'wallets_insert_anon'
  ) then
    create policy wallets_insert_anon on public.wallets
      for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets' and policyname = 'wallets_update_anon'
  ) then
    create policy wallets_update_anon on public.wallets
      for update to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets' and policyname = 'wallets_delete_anon'
  ) then
    create policy wallets_delete_anon on public.wallets
      for delete to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'positions' and policyname = 'positions_read_anon'
  ) then
    create policy positions_read_anon on public.positions
      for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'positions' and policyname = 'positions_insert_anon'
  ) then
    create policy positions_insert_anon on public.positions
      for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'positions' and policyname = 'positions_update_anon'
  ) then
    create policy positions_update_anon on public.positions
      for update to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'positions' and policyname = 'positions_delete_anon'
  ) then
    create policy positions_delete_anon on public.positions
      for delete to anon using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallets' and policyname = 'wallets_rw_authenticated'
  ) then
    create policy wallets_rw_authenticated on public.wallets
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'positions' and policyname = 'positions_rw_authenticated'
  ) then
    create policy positions_rw_authenticated on public.positions
      for all to authenticated using (true) with check (true);
  end if;
end
$$;

commit;
