# DEF-108 Datenbankstruktur (Supabase, relational)

DEF-108 nutzt jetzt eine relationale Struktur ohne JSON-Blob.

## Tabellen

### `public.wallets`

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `name text not null`
- `created_at timestamptz not null default now()`

### `public.positions`

- `id uuid primary key`
- `wallet_id uuid not null references wallets(id)`
- `asset_name text not null`
- `amount numeric not null default 0`
- `value numeric not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Migration

Das SQL-Skript `scripts/sql/defi_manager_schema_v1.sql` migriert Legacy-Daten aus
`public.defi_manager_state.payload` in die neuen Tabellen und entfernt danach
`public.defi_manager_state`.

## RLS

RLS ist fuer beide Tabellen aktiviert und enthaelt fuer das aktuelle
frontend-only Setup `anon`-Policies fuer `select/insert/update/delete`.
