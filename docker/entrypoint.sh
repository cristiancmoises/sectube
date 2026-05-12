#!/bin/sh
# SecTube nginx entrypoint.
# Renders /etc/nginx/templates/default.conf.template -> /tmp/default.conf with
# sed (BusyBox built-in, no extra packages required), then execs nginx pointed
# at our custom main config which `include`s the rendered fragment.
set -eu

: "${RAPIDAPI_HOST:=youtube-v31.p.rapidapi.com}"
: "${RAPIDAPI_KEY:=}"
: "${SERVER_PORT:=8080}"
: "${NGINX_RESOLVERS:=1.1.1.1 8.8.8.8 9.9.9.9}"

if [ -z "$RAPIDAPI_KEY" ]; then
  echo "[sectube] WARN: RAPIDAPI_KEY is empty. The UI will render but /api calls will fail."
  echo "[sectube] Set RAPIDAPI_KEY in .env and restart to enable search/browse."
fi

echo "[sectube] rapidapi host:  $RAPIDAPI_HOST"
echo "[sectube] nginx resolvers: $NGINX_RESOLVERS"

TEMPLATE=/etc/nginx/templates/default.conf.template
OUT=/tmp/default.conf

# Escape sed-special chars in replacement values.
escape() {
  printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'
}

RAPIDAPI_KEY_ESC=$(escape "$RAPIDAPI_KEY")
RAPIDAPI_HOST_ESC=$(escape "$RAPIDAPI_HOST")
SERVER_PORT_ESC=$(escape "$SERVER_PORT")
NGINX_RESOLVERS_ESC=$(escape "$NGINX_RESOLVERS")

sed \
  -e "s|\${RAPIDAPI_KEY}|${RAPIDAPI_KEY_ESC}|g" \
  -e "s|\${RAPIDAPI_HOST}|${RAPIDAPI_HOST_ESC}|g" \
  -e "s|\${SERVER_PORT}|${SERVER_PORT_ESC}|g" \
  -e "s|\${NGINX_RESOLVERS}|${NGINX_RESOLVERS_ESC}|g" \
  "$TEMPLATE" > "$OUT"

nginx -t -c /etc/nginx/nginx.sectube.conf
exec nginx -c /etc/nginx/nginx.sectube.conf -g 'daemon off;'
