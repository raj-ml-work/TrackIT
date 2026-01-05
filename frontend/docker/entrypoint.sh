#!/usr/bin/env sh
set -e

API_URL="${VITE_API_URL:-}"

cat <<EOF > /usr/share/nginx/html/config.js
window.__APP_CONFIG__ = {
  VITE_API_URL: "${API_URL}"
};
EOF

exec nginx -g 'daemon off;'
