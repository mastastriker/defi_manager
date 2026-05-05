#!/usr/bin/env bash
set -euo pipefail

: "${PAPERCLIP_SUPABASE_URL:?PAPERCLIP_SUPABASE_URL is required}"
: "${PAPERCLIP_SUPABASE_ANON_KEY:?PAPERCLIP_SUPABASE_ANON_KEY is required}"

cat > supabase-config.local.js <<CONFIG
window.__DEFI_MANAGER_CONFIG__ = {
  supabaseUrl: "${PAPERCLIP_SUPABASE_URL}",
  supabaseAnonKey: "${PAPERCLIP_SUPABASE_ANON_KEY}"
};
CONFIG

echo "Created supabase-config.local.js from PAPERCLIP_SUPABASE_* env vars."
