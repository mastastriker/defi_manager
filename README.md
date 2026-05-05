# DeFi Depot Verwaltung (DEF-111)

Diese Version implementiert:
- Supabase Auth (Login, Registrierung, Logout, Session Guard)
- Depotverwaltung mit `portfolios`, `wallets`, `positions`
- Gesamtansicht (alle Depots) und Einzeldepot-Ansicht
- Wallet- und Position-CRUD pro Depot

## Setup

1. Starte lokal einen Static Server:

```bash
python3 -m http.server 4173
```

2. Stelle ENV Runtime Config bereit:

```bash
./scripts/write-supabase-config-from-env.sh
```

Benötigte Variablen:
- `PAPERCLIP_SUPABASE_URL`
- `PAPERCLIP_SUPABASE_ANON_KEY`

3. Öffne `http://localhost:4173`.

## Datenbank

Schema anwenden:

```sql
-- scripts/sql/defi_manager_schema_v1.sql
```

Demo-Daten anwenden:

```sql
-- scripts/sql/defi_manager_demo_seed.sql
```

Wichtig: Der Auth User `demo@example.com` muss vorher in Supabase Auth angelegt sein (Passwort `demo123`).

## Hinweise

- `user_id` wird durch Supabase Auth + RLS kontrolliert.
- Frontend nutzt nur Supabase Client API, kein raw SQL.
- Ansichten und Summen werden aus Supabase Daten berechnet.
