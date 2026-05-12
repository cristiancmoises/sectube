# SecTube v3

A self-hosted YouTube browser. Multi-theme tech aesthetic (5 palettes), Japan-first defaults, country selector, custom YouTube IFrame API player with cyan-themed overlay controls, no login. React 18 SPA served by hardened nginx, RapidAPI YouTube proxy with the key injected server-side so it never reaches the browser.

## Quickstart

```bash
git clone <your-fork>
cd sectube
cp .env.example .env
# Edit .env — paste your RAPIDAPI_KEY (free tier at https://rapidapi.com/ytdlfree/api/youtube-v31)
docker compose up -d
```

Open <http://localhost:8080>. Click a category — Japanese videos load in cyan-on-black.

## Stack

```
   browser ─▶ sectube (nginx + React SPA)
                  │  /api/* — key injected server-side
                  ▼
              RapidAPI (youtube-v31)
```

Single container, ~50 MB image, runs as UID 101, read-only rootfs, all caps dropped.

## UI/UX

- **Animated wordmark.** Typewriter effect on first visit per browser session; underline sweep on subsequent visits. Respects `prefers-reduced-motion`.
- **Cyan/black palette.** AAA contrast throughout (verified). Magenta `#ff4081` reserved for errors so they read distinctly.
- **Monospace numerics.** JetBrains Mono for view counts, durations, statistics, badges.
- **Subtle scanline overlay.** Fixed, doesn't fight legibility.
- **Skeleton loaders.** Match the real VideoCard shape so the layout doesn't jump.
- **Responsive grid.** Single-column on mobile, fluid grid on tablet/desktop via CSS Grid `auto-fill minmax(280px, 1fr)`.
- **Backdrop-blur sticky navbar.**

## Themes

Five themes ship: **SecurityOps** (default cyan/black), **Crimson** (red/black), **Synthwave** (magenta/violet), **Matrix** (phosphor green), **Mono** (white-on-black). Pick via the palette icon in the navbar. Choice persists in localStorage as `sectube.theme`.

To add a new theme: append an entry to `themes` in `src/theme.js` AND a matching `[data-theme="…"]` block in `src/index.css`. Rebuild the SPA.

## Country / region

Twelve regions in the navbar dropdown (JP US GB DE FR BR IN KR ES IT CA AU). Default is JP. Choice persists in localStorage as `sectube.region`. Every search request picks up the current selection live — no reload needed.

## Custom player

Watch pages use the YouTube IFrame API (not a plain iframe) with our own cyan-themed overlay controls: play/pause, scrubber, volume, fullscreen, picture-in-picture (best-effort, opens YouTube), open-on-YouTube. YouTube's logo still appears on the embed itself (their requirement). Player auto-hides controls on inactivity during playback.

## Channel pages

Tabs: **Videos | Shorts | Live | Playlists**. Each tab paginates via "Load more" up to YouTube's ~500-item search cap (Google-imposed, not ours). Shorts detected by portrait-aspect thumbnail (best heuristic available from the API).

## Configuration

`.env` is the only file you edit. Required: `RAPIDAPI_KEY`. Defaults below.

```env
RAPIDAPI_KEY=         # required for /api to work
RAPIDAPI_HOST=youtube-v31.p.rapidapi.com
HOST_PORT=8080
# DNS overrides for strict-killswitch VPNs:
# DOCKER_DNS=10.64.0.1
# NGINX_RESOLVERS=10.64.0.1
```

To change Japan-first defaults: edit `DEFAULT_REGION` and `DEFAULT_LANGUAGE` in `src/services/region.js`, then `./scripts/build.sh && docker compose build sectube && docker compose up -d`.

## Deploying behind Nginx Proxy Manager / Caddy / Traefik

`sectube` listens on `8080` inside its container, published to `${HOST_PORT}:8080`. Point your reverse proxy at `http://<host>:<HOST_PORT>` and let it handle TLS.

SecTube's nginx already sets HSTS-friendly security headers (CSP, X-Frame-Options DENY, Referrer-Policy) and rate-limits `/api/*` to 10 r/s per IP.

## Updating

```bash
docker compose pull && docker compose build --no-cache && docker compose up -d
```

For SPA-only changes (no Docker rebuild needed):
```bash
./scripts/build.sh   # rebuilds dist/
docker compose up -d --force-recreate sectube
```

## Troubleshooting

**Page loads but every category shows "API access denied"** — RAPIDAPI_KEY missing or wrong. Get one at <https://rapidapi.com/ytdlfree/api/youtube-v31>, paste into `.env`, then `docker compose up -d`.

**Mullvad/strict VPN — DNS errors in logs** — set `DOCKER_DNS=10.64.0.1` and `NGINX_RESOLVERS=10.64.0.1` in `.env`, ensure Mullvad's "Local network sharing" is on, then `docker compose up -d`.

**Build fails with `npm error Exit handler never called!`** — Docker memory too low. Raise to 4GB and rebuild with `--no-cache`. See `AUDIT.md` for details.

## Security & audit

See `SECURITY.md` for the threat model. See `AUDIT.md` for the most recent dependency + container audit.

## License

GPLV3.
