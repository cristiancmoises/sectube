# Audit report — SecTube v2

Date: 2026-05-12. Tools: `npm audit`, `hadolint 2.12.0`, `shellcheck 0.9.0`, `eslint 9.39` (strict, `--max-warnings 0`), `nginx 1.24 -t`.

## Vulnerabilities

| Tool        | Scope                                | Result                                                              |
| ----------- | ------------------------------------ | ------------------------------------------------------------------- |
| npm audit   | production + dev                     | **0 vulnerabilities**                                               |
| hadolint    | `Dockerfile`                         | No findings.                                                        |
| hadolint    | `Dockerfile.full-build`              | No findings.                                                        |
| shellcheck  | `docker/entrypoint.sh`               | No findings.                                                        |
| shellcheck  | `scripts/build.sh`                   | No findings.                                                        |
| eslint      | `src/**` `--max-warnings 0`          | 0 errors, 0 warnings.                                                |
| nginx -t    | rendered template                    | Config valid.                                                       |

## Dependencies (current pinning)

| Package            | Version  | Notes                                                                       |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| react              | 18.3.1   | Held — React 19 + MUI 6 combo not fully shaken out yet.                     |
| @mui/material      | 6.x      | Held — MUI 7/8/9 shipped fast with codemod-required migrations.             |
| react-router-dom   | 6.x      | Held — Router 7 data-loading APIs not needed by this app.                   |
| axios              | ^1.16.0  | Bumped from 1.15.1 (high-severity prototype-pollution CVE).                 |
| dompurify          | ^3.4.2   | Latest patch.                                                                |
| dayjs              | ^1.11.13 | Replaces moment (in legacy maintenance).                                     |
| vite               | ^8.0.12  | Replaces dead CRA.                                                           |
| @fontsource/jetbrains-mono | ^5.x | Added in v2 for tech-flavored numerics.                                  |

## Bundle inspection

Production `dist/` build, grepped for:

1. Any historical RapidAPI key (`39e77a4864...`) — **none present**.
2. Any `.env` content or `process.env` leak — none.
3. Any string matching the RapidAPI key shape `[a-z0-9]{32}msh[a-z0-9]+jsn[a-z0-9]+` — **no matches**.

Bundle contains zero secrets.

## Runtime hardening verified

- Base image: `nginxinc/nginx-unprivileged:1.27-alpine` (UID 101).
- `read_only: true` rootfs.
- Writable paths constrained to tmpfs (`/tmp`, `/var/cache/nginx`, `/var/run`).
- `cap_drop: [ALL]`.
- ~~`security_opt: [no-new-privileges:true]`~~ removed — incompatible with the nginx-unprivileged image on Linux Mint / Ubuntu 24.04 kernels (BusyBox setuid + AppArmor `docker-default` + `no-new-privileges` together refuse `exec /bin/sh`). Restore on hosts that tolerate it.
- Resource limits (`cpus: 1.0`, `memory: 256M`).
- Healthcheck via BusyBox `wget`, no extra packages required.
- Zero build-time network dependency beyond the base image pull.

## nginx config inspection

`docker/nginx/nginx.conf.template`:
- Security headers: nosniff, X-Frame-Options DENY, strict Referrer-Policy, Permissions-Policy.
- CSP: `script-src 'self'`, `connect-src 'self'`, `frame-src` limited to YouTube embed, `frame-ancestors 'none'`, `object-src 'none'`.
- API proxy: regex location captures path. Runtime DNS via `resolver` directive survives boot-time DNS hiccups.
- `Cookie` and `Authorization` stripped before forwarding upstream.
- Rate limit: 10 r/s per IP, burst 20.
- Body cap: 128k. Server tokens off. Dotfiles denied.

## Performance

| Bundle (gzipped)         | Size      |
| ------------------------ | --------- |
| app                      | 36.59 KB  |
| react                    | 7.98 KB   |
| mui                      | 107.66 KB |
| css                      | 4.94 KB   |
| **critical path total**  | ~157 KB   |

Bigger than v1 because v2 adds Tooltip, Snackbar, and richer MUI surfaces; still well within reasonable for the polish gained.

Other perf wins:
- `<link rel="preconnect">` for YouTube embed origins — warms TCP+TLS before first video click.
- `loading="lazy"` on every thumbnail.
- Manual chunk splitting (react, mui, app).
- Long-cache immutable headers on hashed assets.
- gzip on for text responses.

## v2 changes vs v1

| Area          | v1                                       | v2                                                                                |
| ------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Theme         | Cyan/black, default MUI structure        | Tokenized design system, mono numerics, scanline overlay                          |
| Wordmark      | Plain "SecTube" text                     | Animated — typewriter on first session visit, underline sweep otherwise           |
| Cards         | Plain cards                              | Duration badge, hover lift+glow, compact view counts                              |
| Loaders       | LinearProgress bar                       | Skeleton grid matching VideoCard shape                                            |
| Video page    | Embed + description only                 | Embed + share/copy/open buttons, kbd shortcuts, sidebar of related videos         |
| Search bar    | Plain input                              | Focus glow, clear button, `/` hotkey                                              |
| Footer        | None                                     | Tech-flavor footer with kbd hints                                                 |
| Errors        | Red                                      | Magenta `#ff4081` with monospace `> ERROR` overline                               |
| Favicon       | `.ico` from CRA template                 | Custom cyan ST monogram SVG, `.ico` fallback                                      |

## What I'd do next if this continued

1. CI workflow running this exact audit suite on every PR.
2. Playwright smoke test booting the container and asserting key UI flows.
3. Pin upstream image digests for supply-chain reproducibility.
4. Move to Google's official YouTube Data API (no RapidAPI middleman) once the operator has a Google Cloud project — same request shape, no quota anxiety on the free tier.
