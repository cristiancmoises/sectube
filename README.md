# SecTube v3

A self-hosted YouTube browser. Multi-theme tech aesthetic (5 palettes), Japan-first defaults, country selector, custom YouTube IFrame API player with cyan-themed overlay controls, no login. React 18 SPA served by hardened nginx, **Google YouTube Data API v3** with the key injected server-side so it never reaches the browser.

## Quickstart

```bash
git clone <your-fork>
cd sectube
cp .env.example .env
# Edit .env — paste your GOOGLE_API_KEY (see setup below)
docker compose up -d
```

Open <http://localhost:8080>. Click a category — Japanese videos load in cyan-on-black.

## Google API key setup (5 minutes, free, no credit card)

1. Open <https://console.cloud.google.com>
2. Click the project selector at the top → **New Project** → name it whatever (e.g. "sectube") → **Create**
3. With the project selected, search the top bar for **YouTube Data API v3** → click the result → **Enable**
4. Sidebar → **APIs & Services** → **Credentials** → **Create Credentials** → **API key**
5. Copy the key (looks like `AIzaSy…`)
6. **Strongly recommended:** click the key in the credentials list → **API restrictions** → **Restrict key** → check **YouTube Data API v3** → **Save**. This limits the blast radius if the key ever leaks — it can only call YouTube, not your billing or other Google APIs.
7. Paste the key into `.env` as `GOOGLE_API_KEY=AIzaSy…`
8. `docker compose up -d`

**Free quota:** 10,000 units/day. Each `/search` call costs 100 units → ~100 searches/day. Each `/videos` call costs 1 unit. Quota resets at midnight Pacific time. No billing. No credit card required.

## Stack

```
   browser ─▶ sectube (nginx + React SPA)
                  │  /api/* — key injected server-side via ?key=…
                  ▼
              Google YouTube Data API v3
```

Single container, ~50 MB image, UID 101, read-only rootfs, all caps dropped.

## UI/UX

- Animated SecTube wordmark — typewriter on first session visit, underline sweep otherwise. Respects `prefers-reduced-motion`.
- Custom navbar logo from `/sec-logo.svg`
- Five swappable themes: SecurityOps (cyan, default), Crimson, Synthwave, Matrix, Mono. Persisted.
- Country selector with 12 regions (JP default). Persisted. Live refetch on change.
- 24 categories including Tech, News, JP-News (`日本 ニュース`), Anime, Science, Documentary, Food, Travel.
- Custom YouTube IFrame API player with cyan-themed overlay controls.
- Channel pages with tabs: Videos | Shorts | Live | Playlists.
- Skeleton loaders match VideoCard shape.
- AAA contrast across all themes.
- JetBrains Mono numerics, tabular figures throughout.
- Responsive — single column under 600px, fluid grid above.
- Subtle scanline overlay.

## Configuration

`.env` is the only file you edit. See `.env.example` for the full list.

```env
GOOGLE_API_KEY=        # required
GOOGLE_API_HOST=youtube.googleapis.com
HOST_PORT=8080
```

## Deploying behind Nginx Proxy Manager / Caddy / Traefik

`sectube` listens on `8080` inside its container, published to `${HOST_PORT}:8080`. Point your reverse proxy at `http://<host>:<HOST_PORT>` and let it handle TLS.

The container's nginx already sets CSP, X-Frame-Options DENY, Referrer-Policy, and rate-limits `/api/*` to 10 r/s per IP.

## Updating

```bash
docker compose pull && docker compose build --no-cache && docker compose up -d
```

For SPA-only changes:
```bash
./scripts/build.sh && docker compose up -d --force-recreate sectube
```

## Troubleshooting

**Every API call returns "Daily API quota reached"** — 10,000 units/day is gone. Either wait for midnight Pacific reset, or in Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas, you can request more (free, takes a few days for approval, or instant if you enable billing on the project — Google gives $300 free credit).

**"API access denied"** — `GOOGLE_API_KEY` missing, wrong, or has IP/referrer restrictions blocking your server. Re-check the key, and if you restricted by referrer/IP, either remove that restriction or add your domain/IP to the allowed list.

**Mullvad/strict VPN — DNS errors in logs** — set `DOCKER_DNS=10.64.0.1` and `NGINX_RESOLVERS=10.64.0.1` in `.env`, ensure Mullvad's "Local network sharing" is on, then `docker compose up -d`.

**Build fails with `npm error Exit handler never called!`** — Docker memory too low. Raise to 4GB and rebuild with `--no-cache`.

## Why Google API instead of RapidAPI

- Free, no credit card, no quota anxiety beyond 10k/day
- Cuts out the RapidAPI middleman (their API was just a proxy of this one)
- No surprise overage charges
- Direct Google relationship — supportable

Trade-off: quota is daily, not monthly. If your launch goes viral and burns quota in an hour, the site shows the friendly "quota reached" message until midnight Pacific. For most personal/small-public deployments this is fine.

## Security & audit

See `SECURITY.md` for the threat model. See `AUDIT.md` for the most recent dependency + container audit.

## License

GPLv3.
