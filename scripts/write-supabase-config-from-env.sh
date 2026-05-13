#!/usr/bin/env bash
set -euo pipefail

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_PAPERCLIP_SUPABASE_URL:-${PAPERCLIP_SUPABASE_URL:-}}}"
SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_PAPERCLIP_SUPABASE_ANON_KEY:-${PAPERCLIP_SUPABASE_ANON_KEY:-}}}"

: "${SUPABASE_URL:?Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_PAPERCLIP_SUPABASE_URL or PAPERCLIP_SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_PAPERCLIP_SUPABASE_ANON_KEY or PAPERCLIP_SUPABASE_ANON_KEY}"

cat > ./supabase-config.local.js <<CONFIG
window.__DEFI_MANAGER_CONFIG__ = {
  supabaseUrl: "${SUPABASE_URL}",
  supabaseAnonKey: "${SUPABASE_ANON_KEY}"
};
CONFIG

echo "Created supabase-config.local.js from NEXT_PUBLIC_* or PAPERCLIP_* env vars."

# Kopiere ins Vercel Output falls es existiert
if [ -d ".vercel/output/static" ]; then
  cp supabase-config.local.js .vercel/output/static/
fi

# Für normalen Static Output
if [ ! -f "supabase-config.local.js" ] || [ ! -s "supabase-config.local.js" ]; then
  echo "ERROR: supabase-config.local.js wurde nicht korrekt erstellt!"
  exit 1
fi
