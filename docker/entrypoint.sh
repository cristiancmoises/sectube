#!/bin/sh
# SecTube OpenResty entrypoint.
# Renders /etc/nginx/templates/default.conf.template -> /tmp/default.conf with
# sed (BusyBox built-in), then execs openresty pointed at our custom main config
# which `include`s the rendered fragment.
#
# The API key(s) are NOT rendered into the config. They are exported to the
# environment here and read by the Lua rotator via os.getenv(), so secrets never
# land in a file on disk.
set -eu

: "${GOOGLE_API_HOST:=youtube.googleapis.com}"
: "${GOOGLE_API_KEY:=}"
: "${GOOGLE_API_KEYS:=}"
: "${SERVER_PORT:=8080}"
: "${NGINX_RESOLVERS:=1.1.1.1 8.8.8.8 9.9.9.9}"

# Export so the `env` directives in nginx.sectube.conf can hand them to Lua.
export GOOGLE_API_KEY GOOGLE_API_KEYS
export GOOGLE_KEY_QUOTA_COOLDOWN="${GOOGLE_KEY_QUOTA_COOLDOWN:-}"
export GOOGLE_KEY_RATE_COOLDOWN="${GOOGLE_KEY_RATE_COOLDOWN:-}"
export GOOGLE_KEY_BAD_COOLDOWN="${GOOGLE_KEY_BAD_COOLDOWN:-}"
export GOOGLE_API_CACHE_TTL="${GOOGLE_API_CACHE_TTL:-}"

# Count configured keys (comma / whitespace / semicolon separated) for the log.
KEY_COUNT=$(printf '%s %s' "$GOOGLE_API_KEYS" "$GOOGLE_API_KEY" \
  | tr ',;' '  ' | tr -s ' \t\n' '\n' | grep -c . || true)

if [ "$KEY_COUNT" -eq 0 ]; then
  echo "[sectube] WARN: no API keys set. The UI renders but /api calls will fail."
  echo "[sectube] Get keys at https://console.cloud.google.com — enable 'YouTube Data API v3'."
  echo "[sectube] Set GOOGLE_API_KEYS (comma-separated) in .env and restart."
else
  echo "[sectube] api keys configured: $KEY_COUNT (rotating)"
fi

echo "[sectube] google api host:   $GOOGLE_API_HOST"
echo "[sectube] nginx resolvers:   $NGINX_RESOLVERS"

TEMPLATE=/etc/nginx/templates/default.conf.template
OUT=/tmp/default.conf

# Escape sed-special chars in replacement values.
escape() {
  printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'
}

HOST_ESC=$(escape "$GOOGLE_API_HOST")
PORT_ESC=$(escape "$SERVER_PORT")
RES_ESC=$(escape "$NGINX_RESOLVERS")

sed \
  -e "s|\${GOOGLE_API_HOST}|${HOST_ESC}|g" \
  -e "s|\${SERVER_PORT}|${PORT_ESC}|g" \
  -e "s|\${NGINX_RESOLVERS}|${RES_ESC}|g" \
  "$TEMPLATE" > "$OUT"

openresty -t -c /etc/nginx/nginx.sectube.conf
exec openresty -c /etc/nginx/nginx.sectube.conf -g 'daemon off;'
