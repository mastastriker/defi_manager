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
