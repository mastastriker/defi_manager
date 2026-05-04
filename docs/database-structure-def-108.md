# DEF-108 Datenbankstruktur (Supabase)

Diese Struktur standardisiert die Persistenz fuer den DeFi Manager in Supabase.
Das SQL-Skript ist migrationsfaehig: bestehende Tabellen werden auf den DEF-108 Stand aktualisiert.

## Tabellen

### `public.defi_manager_state`

Single-Row State Store fuer die aktuelle App-Logik.

- `id text primary key`: logical record key (aktuell: `global`)
- `payload jsonb not null`: kompletter App-State (wallets + positions)
- `schema_version integer not null default 1`: Versionskennung fuer Migrationen
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Indizes

- `defi_manager_state_updated_at_idx` auf `updated_at desc`

## Trigger

- `set_defi_manager_state_updated_at`: setzt `updated_at` bei jedem Update automatisch

## RLS

- RLS aktiviert
- Policy `defi_manager_state_read_anon`: `select` fuer `anon`
- Policy `defi_manager_state_insert_anon`: `insert` fuer `anon`
- Policy `defi_manager_state_update_anon`: `update` fuer `anon`

Hinweis: Diese Policies sind fuer das aktuelle frontend-only MVP ohne Auth gedacht. Sobald Auth eingefuehrt wird, muessen die Policies restriktiv auf authentifizierte Nutzer umgestellt werden.

## Seeder

- Stellt sicher, dass Row `id='global'` existiert
- Initialisiert leeres Payload-Objekt:
  - `positions: []`
  - `wallets: ["Cash1", "Cash2"]`
  - `version: 2`
