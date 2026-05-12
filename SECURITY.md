# Security

## Threat model

SecTube is a static React SPA + nginx reverse proxy talking to RapidAPI. No user database, no session state, no login. Data flowing through:

1. **Search/browse requests** from anonymous visitors → SecTube nginx → RapidAPI.
2. **A RapidAPI key** stored only on the host's `.env`, injected into upstream requests by nginx.

Threats considered, in priority order:

| # | Threat                                          | Mitigation                                                                                                          |
| - | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1 | API key exfiltration via the browser bundle     | Key never leaves the host. nginx injects `X-RapidAPI-Key` server-side. Grepping `dist/` returns no match.            |
| 2 | XSS via untrusted YouTube descriptions / titles | All HTML-bearing strings pass through DOMPurify with a `<br>/<p>/<a>`-only allowlist, http(s)-only URIs.            |
| 3 | XSS via route params used in iframe `src`       | Video IDs validated against `^[a-zA-Z0-9_-]{11}$`, channel IDs against `^[\w-]{6,64}$` before use.                  |
| 4 | Clickjacking                                    | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`.                                                              |
| 5 | Quota/key abuse                                 | nginx rate-limits `/api/*` to 10 r/s/IP, burst 20. CSP `connect-src 'self'` blocks cross-origin XHR.                |
| 6 | Mixed-content downgrade                         | All upstream calls go to `https://`. Reverse-proxy in front terminates TLS for public deployments.                  |
| 7 | Container escape                                | Read-only rootfs, all caps dropped, runs as UID 101 (unprivileged), `nginxinc/nginx-unprivileged` base.              |
| 8 | Supply-chain attack on deps                     | `npm audit` clean (0 vulns prod+dev). Lockfile committed. Updates verified before bump.                              |

## Out of scope

- **DDoS at the edge.** nginx rate-limit caps per-IP burst but cannot absorb a real botnet. Use Cloudflare or similar if public.
- **Compromise of the host.** An attacker with host root can read `.env`. Use Docker secrets or a real secret manager in production.
- **RapidAPI/YouTube ToS.** Operator responsibility.

## Notable rotations

- The RapidAPI key that shipped in the original `src/service/api.service.js` was public from the moment that file was committed. **It is burned.** Anyone deploying this project rotates it on the RapidAPI dashboard before first deployment.

## Reporting

Found a vulnerability? Open a private issue or email the maintainer. Don't post exploit details in a public issue.
Contact: sac@securityops.co
