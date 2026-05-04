-- DEF-108: Supabase Datenbankstruktur fuer DeFi Manager

create table if not exists public.defi_manager_state (
  id text primary key,
  payload jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists defi_manager_state_updated_at_idx
  on public.defi_manager_state (updated_at desc);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_defi_manager_state_updated_at on public.defi_manager_state;
create trigger set_defi_manager_state_updated_at
before update on public.defi_manager_state
for each row
execute function public.set_updated_at_timestamp();

alter table public.defi_manager_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'defi_manager_state'
      and policyname = 'defi_manager_state_read_anon'
  ) then
    create policy defi_manager_state_read_anon
      on public.defi_manager_state
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'defi_manager_state'
      and policyname = 'defi_manager_state_insert_anon'
  ) then
    create policy defi_manager_state_insert_anon
      on public.defi_manager_state
      for insert
      to anon
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'defi_manager_state'
      and policyname = 'defi_manager_state_update_anon'
  ) then
    create policy defi_manager_state_update_anon
      on public.defi_manager_state
      for update
      to anon
      using (true)
      with check (true);
  end if;
end
$$;

insert into public.defi_manager_state (id, payload, schema_version)
values (
  'global',
  jsonb_build_object(
    'version', 2,
    'positions', jsonb_build_array(),
    'wallets', jsonb_build_array('Cash1', 'Cash2')
  ),
  1
)
on conflict (id) do nothing;
