# Audit report — SecTube v3 (Google API edition)

Date: 2026-05-12. Tools: `npm audit`, `hadolint 2.12.0`, `shellcheck 0.9.0`, `eslint 9.39` (strict, `--max-warnings 0`), `nginx 1.24 -t`, live nginx end-to-end mock.

## Vulnerabilities

| Tool | Scope | Result |
|---|---|---|
| npm audit | production + dev | **0 vulnerabilities** |
| hadolint | `Dockerfile`, `Dockerfile.full-build` | No findings |
| shellcheck | `docker/entrypoint.sh`, `scripts/build.sh` | No findings |
| eslint | `src/**` `--max-warnings 0` | 0 errors, 0 warnings |
| nginx -t | rendered template | Config valid |
| **live end-to-end** | mock upstream, real nginx | `?key=` correctly appended to BOTH no-args and with-args paths |

## Bundle inspection

Production `dist/` build, grepped for:
1. Any historical RapidAPI key (`39e77a4864...`) — none.
2. Any Google API key pattern (`AIzaSy…`) — none.
3. Any `.env`, `GOOGLE_API_KEY`, `process.env` leak — none.

Bundle contains zero secrets.

## Migration validation

The proxy correctly transforms:
- Browser request: `/api/search?part=snippet&q=test&regionCode=JP`
- Upstream URL:    `https://youtube.googleapis.com/youtube/v3/search?part=snippet&q=test&regionCode=JP&key=AIzaSy…`

And the no-args case:
- Browser request: `/api/channels`
- Upstream URL:    `https://youtube.googleapis.com/youtube/v3/channels?key=AIzaSy…`

Both paths verified with a live mock upstream that echoes the request URI back.

## Runtime hardening

- Base: `nginxinc/nginx-unprivileged:1.27-alpine` (UID 101).
- `read_only: true` rootfs.
- Writable paths constrained to tmpfs.
- `cap_drop: [ALL]`.
- ~~`security_opt: [no-new-privileges:true]`~~ removed — incompatible with the nginx-unprivileged image on Linux Mint / Ubuntu 24.04 kernels.
- Resource limits (`cpus: 1.0`, `memory: 256M`).

## nginx config (Google API edition)

`docker/nginx/nginx.conf.template`:
- Security headers: nosniff, X-Frame-Options DENY, strict Referrer-Policy, Permissions-Policy.
- CSP allows YouTube IFrame API + embed origins.
- API proxy: regex location captures path, prepends `/youtube/v3/`, appends `?key=…` to args (handles empty-args case via conditional `set`).
- TLS verification on, server name pinning on.
- `Cookie` and `Authorization` stripped before forwarding upstream.
- Rate limit: 10 r/s per IP, burst 20.
- Body cap: 128k. Server tokens off. Dotfiles denied.

## Bundle sizes

| Asset (gzipped) | Size |
|---|---|
| app | 40.7 KB |
| react | 8.0 KB |
| mui | 117.4 KB |
| css | 5.8 KB |
| **critical path** | ~172 KB |

## What changed in this migration vs v3-RapidAPI

| File | Change |
|---|---|
| `docker/nginx/nginx.conf.template` | Removed `proxy_set_header X-RapidAPI-Key/Host`. Added `?key=…` injection via `set $upstream_args`. Changed `proxy_pass` target to include `/youtube/v3/`. |
| `docker/entrypoint.sh` | Renamed env vars: `RAPIDAPI_KEY` → `GOOGLE_API_KEY`, `RAPIDAPI_HOST` → `GOOGLE_API_HOST` (default `youtube.googleapis.com`). |
| `docker-compose.yml` | Same env var rename. |
| `.env.example` | New Google Cloud setup instructions inline. |
| `src/services/api.js` | Adapted error mapping: Google uses 403 + `reason=quotaExceeded` instead of 429. Added `googleReasonOf()` helper to extract the structured error from Google's response body. |
| `src/components/Loader.jsx` | Error panel hint updated to reference `GOOGLE_API_KEY`. |
| `src/components/Footer.jsx` | Attribution updated. |
| `README.md`, `SECURITY.md`, `AUDIT.md` | Rewritten for Google API. |

## What did NOT change

The frontend response handling. Google YouTube Data API v3 returns the same JSON shape RapidAPI was returning (because RapidAPI's "youtube-v31" was a proxy of this API). Every component that reads `data.items[*].id.videoId`, `snippet.title`, `statistics.viewCount`, etc. keeps working without any change.
