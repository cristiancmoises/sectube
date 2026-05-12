#!/bin/sh
# Build the React bundle into ./dist
#
# If you have Node on your host, this runs `npm ci && npm run build` directly.
# If you don't, it runs the same commands inside a one-off `node:22-slim`
# container and writes the output to your host's ./dist.
#
# Either way, `docker compose up -d` can then serve the result.
set -eu

cd "$(dirname "$0")/.."

if command -v npm >/dev/null 2>&1; then
  echo "[sectube] Building with host npm (found: $(node -v))..."
  npm ci --prefer-offline --no-audit --no-fund --no-progress
  NODE_OPTIONS="--max-old-space-size=4096" npm run build
  echo "[sectube] Done. dist/ is ready."
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[sectube] ERROR: need either npm or docker to build."
  exit 1
fi

echo "[sectube] No host npm found. Building in a throwaway node:22-slim container..."
# --memory limit is advisory; raise if your Docker has more available.
docker run --rm \
  --memory=4g \
  -v "$PWD:/app" \
  -w /app \
  -e NPM_CONFIG_FETCH_TIMEOUT=60000 \
  -e NPM_CONFIG_FETCH_RETRIES=2 \
  -e NPM_CONFIG_FUND=false \
  -e NPM_CONFIG_AUDIT=false \
  -e NPM_CONFIG_PROGRESS=false \
  -e NODE_OPTIONS=--max-old-space-size=4096 \
  node:22-slim \
  sh -c 'npm ci --prefer-offline --no-audit --no-fund --no-progress && npm run build'

echo "[sectube] Done. dist/ is ready."
