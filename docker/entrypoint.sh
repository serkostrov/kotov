#!/bin/sh
set -eu

ROOT="/usr/share/nginx/html"
URL="${VITE_SUPABASE_URL:-}"
KEY="${VITE_SUPABASE_ANON_KEY:-}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "WARNING: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty. Set them in Dokploy Environment." >&2
fi

# Escape chars that break sed replacement when delimiter is |
sed_escape() {
  printf '%s' "$1" | sed \
    -e 's/\\/\\\\/g' \
    -e 's/|/\\|/g' \
    -e 's/&/\\&/g'
}

SAFE_URL="$(sed_escape "$URL")"
SAFE_KEY="$(sed_escape "$KEY")"

# Inject into built assets (no public /env.js endpoint)
find "$ROOT" -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' \) -print0 \
  | xargs -0 -r sed -i \
      -e "s|__KOTOV_SUPABASE_URL__|${SAFE_URL}|g" \
      -e "s|__KOTOV_SUPABASE_ANON_KEY__|${SAFE_KEY}|g"

# Remove any leftover env artifacts from the image
rm -f "$ROOT/env.js" "$ROOT/.env" "$ROOT/.env.production"

exec nginx -g "daemon off;"
