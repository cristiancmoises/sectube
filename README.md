# SecTube v4

A self-hosted YouTube browser. Multi-theme tech aesthetic (5 palettes), Japan-first defaults, country selector, custom YouTube IFrame API player with cyan-themed overlay controls, infinite-scroll feeds, no login. React 18 SPA served by a hardened **OpenResty** proxy that **rotates across many Google YouTube Data API v3 keys** (server-side, so they never reach the browser) and caches responses to stretch quota.

## What's new in v4

- **Many API keys, auto-rotated.** Give it a comma-separated list of keys. The proxy round-robins across them and, when a key hits `quotaExceeded` / a rate limit / turns invalid, takes it out for a cooldown and retries the same request on the next healthy key. The site keeps working until *every* key is dry — N keys ≈ N× the daily budget.
- **Server-side response cache.** Identical upstream requests (same path+args) are reused from a short-TTL in-memory cache, so many users browsing the same feed cost *one* quota hit, not N.
- **Trending home for 1 unit.** The home feed uses `videos?chart=mostPopular` (1 quota unit, full data) instead of search (100 units).
- **Infinite scroll everywhere** + cards hydrated with real duration and view counts.
- **Keys never touch disk.** They're read from the environment straight into the Lua runtime — unlike the old approach they're never written into the rendered nginx config.

## 🚀 Deploy in 3 steps

Only Docker is required (no Node, no build step — the image builds itself).

**1. Get the code:**
```bash
git clone https://github.com/cristiancmoises/sectube.git
cd sectube
cp .env.example .env
```

**2. 🔑 Add your API key.** Open `.env` and paste your free YouTube Data API key
into `GOOGLE_API_KEYS` — **this is the only line you must edit.** (Don't have a
key yet? It's free and takes 5 minutes — see [Get a free API key](#get-a-free-api-key-5-min).)
```env
# in .env  ↓  one key, or several comma-separated for more quota
GOOGLE_API_KEYS=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**3. Start it** (builds React + the server inside Docker, then runs):
```bash
docker compose up -d --build
```

Open **http://localhost:8080** (or the `HOST_PORT` you set in `.env`). 🎉

> The site still renders with **no** key — `/api` just shows a friendly "set a
> key" message until you add one. Added or changed a key later? Just run
> `docker compose up -d` again (no `--build` needed for `.env`-only changes).

> **Low-memory host (build OOMs / killed)?** Switch `dockerfile:` back to
> `Dockerfile` in `docker-compose.yml`, run `./scripts/build.sh` once to produce
> `dist/`, then `docker compose up -d --build`. See [Low-memory hosts](#low-memory-hosts).

### Operating

```bash
docker compose ps                 # status + health
docker logs -f sectube            # access log + rotation events ("cooling down")
docker logs sectube | grep cool   # which keys went down and why
docker compose restart sectube    # after editing .env
docker compose down               # stop + remove
```

## Get a free API key (5 min)

The key is what you paste into `GOOGLE_API_KEYS` in `.env` (step 2 above). Free,
no credit card.

1. Open <https://console.cloud.google.com>
2. Click the project selector at the top → **New Project** → name it whatever (e.g. "sectube") → **Create**
3. With the project selected, search the top bar for **YouTube Data API v3** → click the result → **Enable**
4. Sidebar → **APIs & Services** → **Credentials** → **Create Credentials** → **API key**
5. Copy the key (looks like `AIzaSy…`)
6. **Strongly recommended:** click the key → **API restrictions** → **Restrict key** → check **YouTube Data API v3** → **Save**. Limits the blast radius if the key leaks.
7. **For more quota, repeat with several projects** — each project gets its own 10,000 units/day. Paste every key into `GOOGLE_API_KEYS`, comma-separated:

```env
# in your .env
GOOGLE_API_KEYS=AIzaSyAAA...,AIzaSyBBB...,AIzaSyCCC...,AIzaSyDDD...
```

8. `docker compose up -d` (no rebuild needed — `.env` is read at start)

> ⚠️ **Server-side use: do NOT add an "HTTP referrer" restriction** to the key
> (Application restrictions → leave **None**, or restrict by **IP**). SecTube
> calls the API from the server, not the browser. If your key *is* referrer-locked,
> set `GOOGLE_API_REFERER` in `.env` to that referrer so the proxy can send it.

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

## Custom domain (Nginx Proxy Manager, Caddy, Traefik…)

`sectube` listens on `8080` inside the container, published to `${HOST_PORT}:8080` on the host. Put any reverse proxy in front for your domain + HTTPS; the container already sets CSP, X-Frame-Options DENY, Referrer-Policy, and rate-limits `/api/*`.

**Nginx Proxy Manager** (most common):
1. Pick a free host port in `.env`, e.g. `HOST_PORT=8090`, then `docker compose up -d`.
2. In NPM → **Proxy Hosts → Add Proxy Host**:
   - **Domain Names:** `tube.yourdomain.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** your server's IP (or `127.0.0.1` if NPM runs on the same host), or the container name `sectube` if NPM shares its Docker network
   - **Forward Port:** `8090` (your `HOST_PORT`)
   - **Block Common Exploits:** on · **Websockets:** on
3. **SSL** tab → request a **Let's Encrypt** cert → Force SSL. Done — `https://tube.yourdomain.com` is live.

> Tip: to keep the port off the public internet and let NPM reach the container by name, put both on the same Docker network and forward to `sectube:8080` instead of a published port.

## Low-memory hosts

The default `docker compose up -d --build` compiles React inside Docker (needs ~1–2 GB free RAM for the build). If the build gets **Killed**/OOMs on a tiny VPS, build the bundle outside Docker instead:

```bash
# one-time, in docker-compose.yml: set  dockerfile: Dockerfile   (the lean image)
./scripts/build.sh            # builds dist/ on the host (uses host npm or a node container)
docker compose up -d --build  # now just copies the prebuilt dist/ — tiny RAM
```

## Updating

The image is built locally (no registry pull). After pulling changes:

```bash
git pull
docker compose up -d --build       # rebuilds React + server inside Docker, recreates
```

Changed only `.env` (e.g. added/rotated keys)? No rebuild — just
`docker compose up -d` (or `docker compose restart sectube`).

## Troubleshooting

**"Daily search quota used up" (search/categories stop, but home still works)** — each search costs 100 units, so ~100 searches/day **per project**. ⚠️ Adding more keys *from the same Cloud project* does **nothing** — quota is per **project**, not per key. Create keys in **separate projects** and list them all in `GOOGLE_API_KEYS`. Or wait for the midnight-Pacific reset. (Home/trending and playback keep working — those cost 1 unit.) Rotation events log at `warn`: `docker logs sectube | grep cooling`.

**"Requests from referer … are blocked" / "API access denied"** — the key has an **HTTP-referrer restriction**, which doesn't suit server-side use. Best: Console → key → **Application restrictions → None** (keep **API restrictions → YouTube Data API v3**). Or, to keep the restriction, set `GOOGLE_API_REFERER` in `.env` to the exact referrer the key allows.

**`pull access denied for sectube` / `"/dist": not found` on build** — you're on the lean `Dockerfile` without a prebuilt `dist/`. The default `docker-compose.yml` now uses `Dockerfile.full-build` (self-contained) — `git pull` and `docker compose up -d --build`. (Low RAM? see [Low-memory hosts](#low-memory-hosts).)

**Mullvad/strict VPN — DNS errors in logs** (`could not be resolved`) — nginx's `resolver` can't reach public DNS. Set `DOCKER_DNS=10.64.0.1` and `NGINX_RESOLVERS=10.64.0.1` in `.env`, ensure Mullvad's "Local network sharing" is on, then `docker compose up -d`.

**Build fails with `npm error Exit handler never called!`** — Docker memory too low. Raise to 4GB and rebuild with `--no-cache`.

## Why rotation

A single free key is capped at 10,000 units/day (~100 searches). One enthusiastic user can exhaust that before lunch. Rotating across several free keys multiplies the daily budget linearly, and the response cache means popular feeds are nearly free. All of it stays server-side — keys never reach the browser, and never get written to disk.

Trade-off: quota is daily, not monthly. If a launch goes viral and burns every key in an hour, the site shows the friendly "quota reached" message until midnight Pacific. Add more keys.

## Security & audit

See `SECURITY.md` for the threat model. See `AUDIT.md` for the most recent dependency + container audit.

## License

GPLv3.
