# Audit report — SecTube v4 (rotating Google API edition)

Date: 2026-06-21. Tools: `npm audit`, `eslint 9` (strict), `luac -p` (Lua syntax), `openresty -t` (config validation in the real base image), a live end-to-end rotation test against Google, `docker build` + hardened `docker run`, and a multi-agent adversarial code review.

## Vulnerabilities

| Tool | Scope | Result |
|---|---|---|
| npm audit | production + dev | **0 vulnerabilities** (fixed react-router, DOMPurify, transitive form-data — all in-range, non-breaking) |
| eslint | `src/**` | 0 errors, 0 warnings |
| luac -p | `docker/nginx/lua/rotator.lua` | Syntax OK |
| openresty -t | rendered config in `openresty:1.27.1.2-alpine` | Config valid; `init_by_lua` runs (keys parsed, `cjson.safe` resolves) |
| **live end-to-end** | real Google upstream, 3 fake keys | Rotation fires across all keys, ErrorInfo `API_KEY_INVALID` detected, cooldowns recorded, exhaustion fallback returns the upstream error |

## Adversarial review

A 4-dimension multi-agent review (Lua/rotation, nginx/OpenResty config, frontend data flow, security/Docker) surfaced 12 candidate issues; each was independently verified. **10 confirmed and fixed**, 2 correctly rejected as false alarms. Highlights:

- Client could inject `key=` into the upstream URL → now parsed args are canonicalized and any client `key` is stripped before the rotated key is appended (also stabilizes the cache key).
- Re-marking a cooling key reset its TTL → `add`-semantics (never reset) + clear-on-success; the all-keys-down state re-probes a single key per request instead of fanning out N.
- Transport/5xx failures aborted instead of rotating, and leaked nginx HTML → now retried on the next key, with a synthesized JSON error when all fail.
- SPA HTML + `/assets/` shipped **no** security headers (nginx `add_header` inheritance reset) → headers factored into `security-headers.conf` and re-included.
- `usePagedVideos` never aborted in-flight requests (quota leak; StrictMode double-load) → `AbortController` threaded through with effect cleanup.
- Channel Shorts split used a thumbnail-aspect heuristic that can't work → duration-based (≤60s); empty/loading state now driven by the pager, not the filtered list.

## API key handling (rotator)

- Keys read from the environment via `os.getenv` in `init_by_lua` — **never written into the rendered config on disk**, never in the image, never sent to the browser.
- Round-robin across all keys (shared-dict cursor); on `quotaExceeded` / rate-limit / invalid/blocked key, the key is cooled down and the request retried on the next healthy key.
- Both legacy `error.errors[].reason` and modern `error.details[].reason` (ErrorInfo) are classified, so a bad key that returns `400 badRequest` + `API_KEY_INVALID` is rotated, while a genuine `badRequest` (malformed query) is passed straight through without wasteful rotation.
- Short-TTL shared response cache keyed on path+args **minus** the key — public data only, no cross-user bleed.

## Runtime hardening

- Base: `openresty/openresty:1.27.1.2-alpine` (nginx + LuaJIT; no third-party Lua modules).
- Runs as a dedicated non-root user (UID 1001).
- `read_only: true` rootfs; writable paths constrained to tmpfs (`/tmp`).
- `cap_drop: [ALL]`.
- `security_opt: [no-new-privileges:true]` — **re-enabled** (the prior removal was a workaround for the old nginx-unprivileged image; verified working on OpenResty under `--read-only`).
- TLS to Google verified (`proxy_ssl_verify on`) with server-name pinning; `ca-certificates` installed.
- Rate limit: 10 r/s per IP, burst 20. Body cap 128k. Server tokens off. Dotfiles denied.
- `/__yt/` upstream location is `internal` (only reachable via the rotator's subrequest); upstream host pinned to `$GOOGLE_API_HOST`.

## Bundle sizes (gzipped)

Critical path (landing): MUI 112.8K · react 7.8K · vendor (axios+dayjs) 18.6K · app 7.6K · css 5.7K ≈ **152 KB**.
Deferred (loaded on demand): VideoDetail 4.5K, sanitize/DOMPurify 9.9K, Channel 1.9K, Search 0.8K — route-split off the landing bundle.

## What changed vs v3 (single-key)

| File | Change |
|---|---|
| `docker/nginx/lua/rotator.lua` | New — key rotation + response cache + error classification. |
| `docker/nginx/nginx.conf.template` | `/api/` → `content_by_lua` rotator; new `internal` `/__yt/` upstream; security headers via include. |
| `docker/nginx/nginx.sectube.conf` | Lua runtime (package path, shared dicts, `init_by_lua`, `env` passthrough). |
| `docker/nginx/security-headers.conf` | New — security headers snippet, re-included where `add_header` resets inheritance. |
| `docker/entrypoint.sh` | Multi-key env, OpenResty paths, key never rendered into config. |
| `Dockerfile`, `Dockerfile.full-build` | OpenResty base, non-root user, ca-certificates. |
| `docker-compose.yml`, `.env.example` | `GOOGLE_API_KEYS` + cooldown/cache tunables; `no-new-privileges` re-added. |
| `src/hooks/usePagedVideos.js` | New — infinite-scroll pager with hydration, normalization, abort. |
| `src/components/*`, `src/services/*`, `src/utils/sanitize.js` | Infinite scroll, card hydration, trending home, lazy routes, related-by-title fix. |
