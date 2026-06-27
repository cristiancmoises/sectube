# SecTube v4

A self-hosted YouTube browser. Multi-theme tech aesthetic (5 palettes), Japan-first defaults, country selector, custom YouTube IFrame API player with cyan-themed overlay controls, infinite-scroll feeds, no login. React 18 SPA served by a hardened **OpenResty** proxy that **rotates across many Google YouTube Data API v3 keys** (server-side, so they never reach the browser) and caches responses to stretch quota.

## What's new in v4

- **Many API keys, auto-rotated.** Give it a comma-separated list of keys. The proxy round-robins across them and, when a key hits `quotaExceeded` / a rate limit / turns invalid, takes it out for a cooldown and retries the same request on the next healthy key. The site keeps working until *every* key is dry — N keys ≈ N× the daily budget.
- **Server-side response cache.** Identical upstream requests (same path+args) are reused from a short-TTL in-memory cache, so many users browsing the same feed cost *one* quota hit, not N.
- **Trending home for 1 unit.** The home feed uses `videos?chart=mostPopular` (1 quota unit, full data) instead of search (100 units).
- **Infinite scroll everywhere** + cards hydrated with real duration and view counts.
- **Keys never touch disk.** They're read from the environment straight into the Lua runtime — unlike the old approach they're never written into the rendered nginx config.

## Quickstart

```bash
git clone <your-fork>
cd sectube
cp .env.example .env
# Edit .env — paste one or more keys into GOOGLE_API_KEYS (see setup below)
./scripts/build.sh            # build the React bundle into dist/
docker compose up -d --build  # build the image + start the container
```

`./scripts/build.sh` uses your host's `npm` if present, otherwise a throwaway
`node:22-slim` container — either way it produces `dist/`, which the lean default
image serves. (Prefer a single self-contained image build with no host Node and
no separate dist step? Point the compose `build.dockerfile` at
`Dockerfile.full-build`, which builds the bundle inside the image.)

Open <http://localhost:8080>. Click a category — videos load in cyan-on-black.

The site renders even with no keys; `/api` then returns a friendly "admin must
set a key" message until you add keys to `GOOGLE_API_KEYS` and re-run
`docker compose up -d`.

### Operating

```bash
docker compose ps                 # status + health
docker logs -f sectube            # access log + rotation events ("cooling down")
docker logs sectube | grep cool   # which keys went down and why
docker compose restart sectube    # after editing .env
docker compose down               # stop + remove
```

## Google API key setup (5 minutes each, free, no credit card)

1. Open <https://console.cloud.google.com>
2. Click the project selector at the top → **New Project** → name it whatever (e.g. "sectube") → **Create**
3. With the project selected, search the top bar for **YouTube Data API v3** → click the result → **Enable**
4. Sidebar → **APIs & Services** → **Credentials** → **Create Credentials** → **API key**
5. Copy the key (looks like `AIzaSy…`)
6. **Strongly recommended:** click the key → **API restrictions** → **Restrict key** → check **YouTube Data API v3** → **Save**. Limits the blast radius if the key leaks.
7. **For more quota, repeat with several projects** — each project gets its own 10,000 units/day. Paste every key into `GOOGLE_API_KEYS`, comma-separated:

```env
GOOGLE_API_KEYS=AIzaSyAAA...,AIzaSyBBB...,AIzaSyCCC...,AIzaSyDDD...
```

8. `docker compose up -d`

**Free quota:** 10,000 units/day **per key**. Each `/search` costs 100 units; `/videos` and `mostPopular` cost 1. With rotation + caching, a handful of keys comfortably serves a small public deployment. Quota resets at midnight Pacific. No billing, no credit card.

## Stack

```
   browser ─▶ sectube (OpenResty + React SPA)
                  │  /api/* ─▶ rotator.lua
                  │             ├─ shared response cache (cross-user)
                  │             └─ round-robin keys + retry on quota/rate/bad-key
                  ▼            (key appended to the upstream URL only)
              Google YouTube Data API v3
```

Single container, ~157 MB image, unprivileged user, read-only rootfs, all caps dropped.

## UI/UX

- Infinite-scroll feeds (home, search, channel tabs) via IntersectionObserver.
- Real regional **trending** home (`mostPopular`) — full duration + view counts, 1 quota unit.
- Cards hydrated with duration + view counts (batched `videos.list`, 1 unit per 50).
- Animated SecTube wordmark; respects `prefers-reduced-motion`.
- Five swappable themes: SecurityOps (cyan, default), Crimson, Synthwave, Matrix, Mono. Persisted.
- Country selector with 12 regions (JP default). Persisted. Live refetch on change.
- 24 categories including Tech, News, JP-News (`日本 ニュース`), Anime, Science, Documentary, Food, Travel.
- Custom YouTube IFrame API player with cyan-themed overlay controls, **keyboard shortcuts** (space/k play-pause, ←/→ ±5s, j/l ±10s, ↑/↓ volume, m mute, f fullscreen, 0–9 seek), and volume/mute **persisted** across videos.
- Channel pages with tabs: Videos | Shorts | Live | Playlists.
- Route-level code splitting — the landing bundle stays lean (Player + DOMPurify load only on the video page).
- Skeleton loaders, AAA contrast, JetBrains Mono tabular numerics, responsive grid, subtle scanlines.

## Configuration

`.env` is the only file you edit. See `.env.example` for the full list.

```env
GOOGLE_API_KEYS=AIzaSy...,AIzaSy...   # one or more keys, comma-separated
GOOGLE_API_KEY=                        # single-key back-compat (merged in)
GOOGLE_API_HOST=youtube.googleapis.com
HOST_PORT=8080

# Optional rotation/cache tuning (sane defaults in docker/nginx/lua/rotator.lua):
# GOOGLE_KEY_QUOTA_COOLDOWN=1800   # s a key sits out after quotaExceeded
# GOOGLE_KEY_RATE_COOLDOWN=30      # s a key sits out after a rate limit
# GOOGLE_KEY_BAD_COOLDOWN=3600     # s an invalid/blocked key sits out
# GOOGLE_API_CACHE_TTL=300         # s a 200 response is reused (0 disables)
```

## Deploying behind Nginx Proxy Manager / Caddy / Traefik

`sectube` listens on `8080` inside its container, published to `${HOST_PORT}:8080`. Point your reverse proxy at `http://<host>:<HOST_PORT>` and let it handle TLS. The container already sets CSP, X-Frame-Options DENY, Referrer-Policy, and rate-limits `/api/*` to 10 r/s per IP.

## Updating

The image is built locally (no registry pull). Rebuild after pulling changes:

```bash
git pull
./scripts/build.sh                 # rebuild the bundle
docker compose up -d --build       # rebuild the image + recreate the container
```

For SPA-only changes (config/headers unchanged):
```bash
./scripts/build.sh && docker compose up -d --build --force-recreate sectube
```

Changed only `.env` (e.g. added keys)? No rebuild needed — just
`docker compose up -d` (or `docker compose restart sectube`).

## Troubleshooting

**Every API call returns "Daily API quota reached"** — *all* your keys are dry for the day. Add more keys to `GOOGLE_API_KEYS` (each project = 10k units/day), wait for the midnight Pacific reset, or raise quota in the Cloud Console. Rotation events are logged at `warn` level (`docker logs sectube | grep cooling`).

**"API access denied"** — a key is missing/invalid or referrer/IP-restricted. The rotator routes around a bad key automatically, but if *all* keys are bad you'll see this. Re-check the keys and restrictions.

**Mullvad/strict VPN — DNS errors in logs** (`could not be resolved`) — nginx's `resolver` can't reach public DNS. Set `DOCKER_DNS=10.64.0.1` and `NGINX_RESOLVERS=10.64.0.1` in `.env`, ensure Mullvad's "Local network sharing" is on, then `docker compose up -d`.

**Build fails with `npm error Exit handler never called!`** — Docker memory too low. Raise to 4GB and rebuild with `--no-cache`.

## Why rotation

A single free key is capped at 10,000 units/day (~100 searches). One enthusiastic user can exhaust that before lunch. Rotating across several free keys multiplies the daily budget linearly, and the response cache means popular feeds are nearly free. All of it stays server-side — keys never reach the browser, and never get written to disk.

Trade-off: quota is daily, not monthly. If a launch goes viral and burns every key in an hour, the site shows the friendly "quota reached" message until midnight Pacific. Add more keys.

## Security & audit

See `SECURITY.md` for the threat model. See `AUDIT.md` for the most recent dependency + container audit.

## License

GPLv3.
