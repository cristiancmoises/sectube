# Security

## Threat model

SecTube is a static React SPA + nginx reverse proxy talking to Google's YouTube Data API v3. No user database, no session state, no login.

| # | Threat | Mitigation |
|---|---|---|
| 1 | API key exfiltration via the browser bundle | Key never leaves the host. nginx appends `?key=…` to the upstream URL server-side. Bundle audited by grep — no match. |
| 2 | XSS via untrusted YouTube descriptions/titles | DOMPurify with `<br>/<p>/<a>`-only allowlist, http(s)-only URIs. |
| 3 | XSS via route params used in iframe `src` | Video IDs validated against `^[a-zA-Z0-9_-]{11}$`, channel IDs `^[\w-]{6,64}$`. |
| 4 | Clickjacking | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. |
| 5 | Quota burn from abuse | nginx rate-limits `/api/*` to 10 r/s/IP, burst 20. CSP `connect-src 'self'` blocks cross-origin XHR. |
| 6 | Mixed-content downgrade | All upstream calls go to `https://`. Reverse-proxy in front terminates TLS for public deployments. |
| 7 | Container escape | Read-only rootfs, all caps dropped, UID 101 unprivileged, `nginxinc/nginx-unprivileged` base. |
| 8 | Supply-chain attack on deps | `npm audit` clean. Lockfile committed. |
| 9 | API key leak via referrer | We restrict the key to YouTube Data API v3 only via the Google Cloud Console — even if leaked, attacker can't pivot to other APIs. |

## Recommended Google Cloud key hardening

After generating the key:
1. **API restrictions:** Restrict to "YouTube Data API v3" only
2. **Application restrictions (optional):** if your server has a stable IP, add it to the allowed list. Don't use HTTP referrer restrictions — the key is used server-to-server, not from a browser, so referrer headers aren't sent.

## Out of scope

- DDoS at the edge — use Cloudflare or similar if public-facing.
- Host compromise — an attacker with host root can read `.env`. Use Docker secrets or a real secret manager in production.
- Google's ToS — operator responsibility.

## Notable rotations

The original RapidAPI key in the upstream repo's `api.service.js` was public from commit; it's burned. SecTube v3 doesn't use RapidAPI anymore — irrelevant now, but flag here for history.

## Reporting

Found a vulnerability? Open a private issue or email the maintainer. Don't post exploit details in a public issue.
