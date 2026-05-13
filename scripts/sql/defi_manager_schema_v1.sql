begin;

create extension if not exists pgcrypto;

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  type text,
  position_date timestamptz,
  chain text,
  project_name text,
  strategy_name text,
  asset_name text not null,
  amount numeric(20,8) not null,
  value_usd numeric(20,2) not null,
  collateral text,
  debt_usd numeric(20,2),
  borrow_payout numeric(20,2),
  maturity_date timestamptz,
  pt_amount numeric(20,8),
  notes text,
  status text default 'active',
  archived_at timestamptz,
  calculation_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.positions add column if not exists type text;
alter table public.positions add column if not exists position_date timestamptz;
alter table public.positions add column if not exists chain text;
alter table public.positions add column if not exists project_name text;
alter table public.positions add column if not exists strategy_name text;
alter table public.positions add column if not exists collateral text;
alter table public.positions add column if not exists debt_usd numeric(20,2);
alter table public.positions add column if not exists borrow_payout numeric(20,2);
alter table public.positions add column if not exists maturity_date timestamptz;
alter table public.positions add column if not exists pt_amount numeric(20,8);
alter table public.positions add column if not exists notes text;
alter table public.positions add column if not exists status text default 'active';
alter table public.positions add column if not exists archived_at timestamptz;
alter table public.positions add column if not exists calculation_mode text;

create index if not exists idx_portfolios_user_id on public.portfolios(user_id);
create index if not exists idx_wallets_portfolio_id on public.wallets(portfolio_id);
create index if not exists idx_wallets_user_id on public.wallets(user_id);
create index if not exists idx_positions_wallet_id on public.positions(wallet_id);
create index if not exists idx_positions_status on public.positions(status);
create index if not exists idx_positions_position_date on public.positions(position_date desc);

-- DEF-112 migration: move legacy JSON payloads into relational tables.
with legacy_users as (
  select uds.user_id, uds.payload
  from public.user_dashboard_state uds
  where uds.payload is not null
),
created_portfolios as (
  insert into public.portfolios (user_id, name)
  select lu.user_id, 'Hauptdepot'
  from legacy_users lu
  where not exists (
    select 1 from public.portfolios p where p.user_id = lu.user_id
  )
  returning id, user_id
),
all_portfolios as (
  select p.id, p.user_id
  from public.portfolios p
  where exists (select 1 from legacy_users lu where lu.user_id = p.user_id)
),
wallet_sources as (
  select ap.user_id, ap.id as portfolio_id, trim(w.value) as wallet_name
  from all_portfolios ap
  join legacy_users lu on lu.user_id = ap.user_id
  cross join lateral jsonb_array_elements_text(coalesce(lu.payload->'wallets', '[]'::jsonb)) as w(value)
  union
  select ap.user_id, ap.id as portfolio_id, trim(pos.value->>'wallet') as wallet_name
  from all_portfolios ap
  join legacy_users lu on lu.user_id = ap.user_id
  cross join lateral jsonb_array_elements(coalesce(lu.payload->'positions', '[]'::jsonb)) as pos(value)
),
distinct_wallets as (
  select ws.user_id, ws.portfolio_id, ws.wallet_name
  from wallet_sources ws
  where coalesce(ws.wallet_name, '') <> ''
),
inserted_wallets as (
  insert into public.wallets (portfolio_id, user_id, name)
  select dw.portfolio_id, dw.user_id, dw.wallet_name
  from distinct_wallets dw
  where not exists (
    select 1 from public.wallets w
    where w.portfolio_id = dw.portfolio_id
      and w.user_id = dw.user_id
      and w.name = dw.wallet_name
  )
  returning id
),
position_rows as (
  select
    lu.user_id,
    ap.id as portfolio_id,
    pos.value as position_json
  from legacy_users lu
  join all_portfolios ap on ap.user_id = lu.user_id
  cross join lateral jsonb_array_elements(coalesce(lu.payload->'positions', '[]'::jsonb)) as pos(value)
),
portfolio_default_wallet as (
  select
    w.user_id,
    w.portfolio_id,
    w.id as wallet_id,
    row_number() over (partition by w.user_id, w.portfolio_id order by w.created_at, w.id) as rn
  from public.wallets w
),
mapped_positions as (
  select
    coalesce(w_named.id, w_default.wallet_id) as wallet_id,
    coalesce(pr.position_json->>'type', 'strategy') as type,
    nullif(pr.position_json->>'date', '')::timestamptz as position_date,
    coalesce(nullif(pr.position_json->>'chain', ''), 'ETH') as chain,
    nullif(pr.position_json->>'projectName', '') as project_name,
    nullif(pr.position_json->>'strategyName', '') as strategy_name,
    coalesce(
      nullif(pr.position_json->>'strategyName', ''),
      nullif(pr.position_json->>'projectName', ''),
      'Position'
    ) as asset_name,
    coalesce((pr.position_json->>'investedAmount')::numeric, 0) as amount,
    coalesce((pr.position_json->>'currentValue')::numeric, 0) as value_usd,
    nullif(pr.position_json->>'collateral', '') as collateral,
    coalesce((pr.position_json->>'debtUsd')::numeric, 0) as debt_usd,
    coalesce((pr.position_json->>'borrowPayout')::numeric, 0) as borrow_payout,
    nullif(pr.position_json->>'maturityDate', '')::timestamptz as maturity_date,
    nullif(pr.position_json->>'ptAmount', '')::numeric as pt_amount,
    nullif(pr.position_json->>'notes', '') as notes,
    coalesce(nullif(pr.position_json->>'status', ''), 'active') as status,
    nullif(pr.position_json->>'archivedAt', '')::timestamptz as archived_at,
    coalesce(nullif(pr.position_json->>'calculationMode', ''), 'current') as calculation_mode
  from position_rows pr
  left join public.wallets w_named
    on w_named.user_id = pr.user_id
   and w_named.portfolio_id = pr.portfolio_id
   and w_named.name = nullif(pr.position_json->>'wallet', '')
  left join portfolio_default_wallet w_default
    on w_default.user_id = pr.user_id
   and w_default.portfolio_id = pr.portfolio_id
   and w_default.rn = 1
),
inserted_positions as (
  insert into public.positions (
    wallet_id,
    type,
    position_date,
    chain,
    project_name,
    strategy_name,
    asset_name,
    amount,
    value_usd,
    collateral,
    debt_usd,
    borrow_payout,
    maturity_date,
    pt_amount,
    notes,
    status,
    archived_at,
    calculation_mode
  )
  select
    mp.wallet_id,
    mp.type,
    mp.position_date,
    mp.chain,
    mp.project_name,
    mp.strategy_name,
    mp.asset_name,
    mp.amount,
    mp.value_usd,
    mp.collateral,
    mp.debt_usd,
    mp.borrow_payout,
    mp.maturity_date,
    mp.pt_amount,
    mp.notes,
    mp.status,
    mp.archived_at,
    mp.calculation_mode
  from mapped_positions mp
  where mp.wallet_id is not null
  returning id
)
select 1;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_portfolios_updated_at on public.portfolios;
create trigger set_portfolios_updated_at before update on public.portfolios
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at before update on public.wallets
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists set_positions_updated_at on public.positions;
create trigger set_positions_updated_at before update on public.positions
for each row execute function public.set_updated_at_timestamp();

alter table public.portfolios enable row level security;
alter table public.wallets enable row level security;
alter table public.positions enable row level security;

drop policy if exists portfolios_select_own on public.portfolios;
create policy portfolios_select_own on public.portfolios for select using (user_id = auth.uid());
drop policy if exists portfolios_insert_own on public.portfolios;
create policy portfolios_insert_own on public.portfolios for insert with check (user_id = auth.uid());
drop policy if exists portfolios_update_own on public.portfolios;
create policy portfolios_update_own on public.portfolios for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists portfolios_delete_own on public.portfolios;
create policy portfolios_delete_own on public.portfolios for delete using (user_id = auth.uid());

drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets for select using (user_id = auth.uid());
drop policy if exists wallets_insert_own on public.wallets;
create policy wallets_insert_own on public.wallets for insert with check (user_id = auth.uid());
drop policy if exists wallets_update_own on public.wallets;
create policy wallets_update_own on public.wallets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists wallets_delete_own on public.wallets;
create policy wallets_delete_own on public.wallets for delete using (user_id = auth.uid());

drop policy if exists positions_select_wallet_owner on public.positions;
create policy positions_select_wallet_owner on public.positions for select
using (wallet_id in (select id from public.wallets where user_id = auth.uid()));
drop policy if exists positions_insert_wallet_owner on public.positions;
create policy positions_insert_wallet_owner on public.positions for insert
with check (wallet_id in (select id from public.wallets where user_id = auth.uid()));
drop policy if exists positions_update_wallet_owner on public.positions;
create policy positions_update_wallet_owner on public.positions for update
using (wallet_id in (select id from public.wallets where user_id = auth.uid()))
with check (wallet_id in (select id from public.wallets where user_id = auth.uid()));
drop policy if exists positions_delete_wallet_owner on public.positions;
create policy positions_delete_wallet_owner on public.positions for delete
using (wallet_id in (select id from public.wallets where user_id = auth.uid()));

commit;
