#!/bin/sh
# SecTube nginx entrypoint.
# Renders /etc/nginx/templates/default.conf.template -> /tmp/default.conf with
# sed (BusyBox built-in), then execs nginx pointed at our custom main config
# which `include`s the rendered fragment.
set -eu

: "${GOOGLE_API_HOST:=youtube.googleapis.com}"
: "${GOOGLE_API_KEY:=}"
: "${SERVER_PORT:=8080}"
: "${NGINX_RESOLVERS:=1.1.1.1 8.8.8.8 9.9.9.9}"

if [ -z "$GOOGLE_API_KEY" ]; then
  echo "[sectube] WARN: GOOGLE_API_KEY is empty. The UI will render but /api calls will fail."
  echo "[sectube] Get a key at https://console.cloud.google.com — enable 'YouTube Data API v3'."
  echo "[sectube] Set GOOGLE_API_KEY in .env and restart to enable search/browse."
fi

echo "[sectube] google api host:   $GOOGLE_API_HOST"
echo "[sectube] nginx resolvers:   $NGINX_RESOLVERS"

TEMPLATE=/etc/nginx/templates/default.conf.template
OUT=/tmp/default.conf

# Escape sed-special chars in replacement values.
escape() {
  printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'
}

KEY_ESC=$(escape "$GOOGLE_API_KEY")
HOST_ESC=$(escape "$GOOGLE_API_HOST")
PORT_ESC=$(escape "$SERVER_PORT")
RES_ESC=$(escape "$NGINX_RESOLVERS")

sed \
  -e "s|\${GOOGLE_API_KEY}|${KEY_ESC}|g" \
  -e "s|\${GOOGLE_API_HOST}|${HOST_ESC}|g" \
  -e "s|\${SERVER_PORT}|${PORT_ESC}|g" \
  -e "s|\${NGINX_RESOLVERS}|${RES_ESC}|g" \
  "$TEMPLATE" > "$OUT"

nginx -t -c /etc/nginx/nginx.sectube.conf
exec nginx -c /etc/nginx/nginx.sectube.conf -g 'daemon off;'
