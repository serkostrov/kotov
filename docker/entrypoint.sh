#!/bin/sh
set -eu

ENV_FILE="/usr/share/nginx/html/env.js"

# Escape for JS string literals
js_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/'"'"'/\\'"'"'/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

URL="$(js_escape "${VITE_SUPABASE_URL:-}")"
KEY="$(js_escape "${VITE_SUPABASE_ANON_KEY:-}")"

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "WARNING: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty. Set them in Dokploy Environment." >&2
fi

cat > "$ENV_FILE" <<EOF
window.__ENV__ = {
  VITE_SUPABASE_URL: "${URL}",
  VITE_SUPABASE_ANON_KEY: "${KEY}"
};
EOF

exec nginx -g "daemon off;"
