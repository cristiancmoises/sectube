#!/bin/sh
# ---------------------------------------------------------------------------
# Fully automatic Google API key provisioning for SecTube.
#
# PREREQUISITE (the one human step): you must already be logged in:
#     gcloud auth login
# That authenticates as YOU — only you can do it. Everything below is automatic.
#
# This script, idempotently:
#   1. creates (or reuses) a Google Cloud project              [free, no billing]
#   2. enables the API Keys API + YouTube Data API v3          [free]
#   3. mints an API key restricted to YouTube Data API v3
#   4. writes it into sectube/.env as GOOGLE_API_KEYS          [never printed]
#   5. redeploys the container and verifies a live /api call
#
# Re-run it any time to mint ADDITIONAL keys for rotation (it appends).
# Env overrides: SECTUBE_GCP_PROJECT=<existing-project-id> to reuse a project.
# ---------------------------------------------------------------------------
set -eu

GCLOUD="${GCLOUD:-gcloud}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

command -v "$GCLOUD" >/dev/null 2>&1 || { echo "ERROR: gcloud not found on PATH (set GCLOUD=/path/to/gcloud)"; exit 1; }

# --- 0. must be authenticated ---------------------------------------------
ACTIVE="$("$GCLOUD" auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
if [ -z "$ACTIVE" ]; then
  echo "ERROR: not logged in. Run this first (only you can):"
  echo "    $GCLOUD auth login"
  exit 2
fi
echo "[setup] authenticated as: $ACTIVE"

# --- 1. project ------------------------------------------------------------
PROJECT="${SECTUBE_GCP_PROJECT:-}"
if [ -z "$PROJECT" ]; then
  PROJECT="sectube-$(date +%s | tail -c 7)"
  echo "[setup] creating project: $PROJECT"
  "$GCLOUD" projects create "$PROJECT" --name="SecTube" >/dev/null
else
  echo "[setup] reusing project: $PROJECT"
fi
"$GCLOUD" config set project "$PROJECT" >/dev/null 2>&1

# --- 2. enable APIs (free, no billing) ------------------------------------
echo "[setup] enabling apikeys.googleapis.com + youtube.googleapis.com (may take ~30s)"
"$GCLOUD" services enable apikeys.googleapis.com youtube.googleapis.com >/dev/null

# --- 3. mint a YouTube-restricted key -------------------------------------
echo "[setup] creating API key (restricted to YouTube Data API v3)"
KEY_NAME="$("$GCLOUD" services api-keys create \
  --display-name="SecTube key $(date +%Y%m%d-%H%M%S)" \
  --api-target=service=youtube.googleapis.com \
  --format='value(response.name)' 2>/dev/null || true)"

# Resolve the key string without printing it.
if [ -n "$KEY_NAME" ]; then
  KEY="$("$GCLOUD" services api-keys get-key-string "$KEY_NAME" --format='value(keyString)' 2>/dev/null || true)"
else
  # Fallback: take the most recently created key for this project.
  LAST="$("$GCLOUD" services api-keys list --format='value(name)' 2>/dev/null | tail -1 || true)"
  KEY="$([ -n "$LAST" ] && "$GCLOUD" services api-keys get-key-string "$LAST" --format='value(keyString)' 2>/dev/null || true)"
fi

case "$KEY" in
  AIza*) : ;;  # looks like a key
  *) echo "ERROR: could not obtain a key string. Check 'gcloud services api-keys list'."; exit 3 ;;
esac
echo "[setup] key minted (value withheld from output)"

# --- 4. write into .env (append for rotation, dedupe) ----------------------
touch "$ENV_FILE"
EXISTING="$(grep -E '^GOOGLE_API_KEYS=' "$ENV_FILE" 2>/dev/null | head -1 | sed 's/^GOOGLE_API_KEYS=//')"
if [ -n "$EXISTING" ]; then
  case ",$EXISTING," in *",$KEY,"*) NEW="$EXISTING" ;; *) NEW="$EXISTING,$KEY" ;; esac
else
  NEW="$KEY"
fi
# Rewrite the GOOGLE_API_KEYS line in place (or add it), without echoing the key.
TMP="$(mktemp)"
if grep -qE '^GOOGLE_API_KEYS=' "$ENV_FILE"; then
  grep -vE '^GOOGLE_API_KEYS=' "$ENV_FILE" > "$TMP"
else
  cp "$ENV_FILE" "$TMP"
fi
printf 'GOOGLE_API_KEYS=%s\n' "$NEW" >> "$TMP"
mv "$TMP" "$ENV_FILE"
KEYCOUNT="$(printf '%s' "$NEW" | tr ',' '\n' | grep -c .)"
echo "[setup] .env now has $KEYCOUNT key(s) in GOOGLE_API_KEYS"

# --- 5. redeploy + verify --------------------------------------------------
echo "[setup] redeploying container"
( cd "$REPO_DIR" && docker compose up -d >/dev/null 2>&1 )
sleep 4
PORT="$(grep -E '^HOST_PORT=' "$ENV_FILE" 2>/dev/null | sed 's/^HOST_PORT=//')"; PORT="${PORT:-8080}"
CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/i18nLanguages?part=snippet&hl=en" || echo 000)"
echo "[setup] live /api check on port $PORT -> HTTP $CODE"
if [ "$CODE" = "200" ]; then
  echo "[setup] SUCCESS — search is live at http://localhost:${PORT}"
else
  echo "[setup] key wired in but /api returned $CODE. If 403/400, the API may still be"
  echo "        propagating (wait ~1 min, retry) or DNS/quotas need a look: docker logs sectube"
fi
