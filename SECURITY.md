# Security

## Threat model

SecTube is a static React SPA + an OpenResty reverse proxy talking to Google's YouTube Data API v3. No user database, no session state, no login.

| # | Threat | Mitigation |
|---|---|---|
| 1 | API key exfiltration via the browser bundle | Keys never leave the host. The Lua rotator appends `key=…` to the *upstream* URL only. Bundle audited by grep — no match. |
| 1b | API key on-disk exposure | Keys are read from the environment straight into worker memory (`os.getenv` in `init_by_lua`) and are **never written into the rendered nginx config** on disk (unlike the prior sed-injection approach). |
| 2 | XSS via untrusted YouTube descriptions/titles | DOMPurify with `<br>/<p>/<a>`-only allowlist, http(s)-only URIs, hardened `rel`/`target`. |
| 3 | XSS via route params used in iframe `src` | Video IDs validated against `^[a-zA-Z0-9_-]{11}$`, channel IDs `^[\w-]{6,64}$`. |
| 4 | Clickjacking | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. |
| 5 | Quota burn from abuse | OpenResty rate-limits `/api/*` to 10 r/s/IP, burst 20. CSP `connect-src 'self'` blocks cross-origin XHR. Shared response cache absorbs duplicate load. |
| 6 | Mixed-content downgrade | All upstream calls go to `https://` with `proxy_ssl_verify on` + server-name pinning. Reverse-proxy in front terminates TLS for public deployments. |
| 7 | Container escape | Read-only rootfs, all caps dropped, unprivileged user, `openresty/openresty:1.27-alpine` base. |
| 8 | Supply-chain attack on deps | `npm audit` clean. Lockfile committed. Rotator uses OpenResty core only — no third-party Lua modules. |
| 9 | API key leak via referrer | Restrict each key to YouTube Data API v3 only in the Cloud Console — even if leaked, an attacker can't pivot to other APIs. |
| 10 | SSRF via the `/api/*` proxy path | Upstream host is pinned to `$GOOGLE_API_HOST`; only the trailing path/query are forwarded. nginx normalizes `..` before location matching, and the internal upstream location is `internal` (unreachable except via the rotator). |
| 11 | Cross-user data bleed via the shared cache | The cache holds only public YouTube API responses, keyed on path+args **excluding** the key. There is no per-user/authenticated data to leak. |

## Recommended Google Cloud key hardening

For every key you add to `GOOGLE_API_KEYS`:
1. **API restrictions:** Restrict to "YouTube Data API v3" only.
2. **Application restrictions (optional):** if your server has a stable IP, add it to the allowed list. Don't use HTTP referrer restrictions — keys are used server-to-server, not from a browser, so referrer headers aren't sent. (A referrer-restricted key would be detected as `ipRefererBlocked` and rotated out automatically.)

## Out of scope

- DDoS at the edge — use Cloudflare or similar if public-facing.
- Host compromise — an attacker with host root can read `.env`. Use Docker secrets or a real secret manager in production.
- Google's ToS — operator responsibility.

## Notable rotations

The original RapidAPI key in the upstream repo's `api.service.js` was public from commit; it's burned. SecTube v3 doesn't use RapidAPI anymore — irrelevant now, but flag here for history.

## Reporting

Found a vulnerability? Open a private issue or email the maintainer. Don't post exploit details in a public issue.
