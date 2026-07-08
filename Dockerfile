# syntax=docker/dockerfile:1.7
# =========================================================================
# Lean image: OpenResty + the prebuilt dist/ directory.
#
# OpenResty (nginx + LuaJIT) powers the API-key rotator + response cache
# (docker/nginx/lua/rotator.lua). Plain nginx can't rotate keys or retry on a
# 403 quotaExceeded body; LuaJIT can, with zero third-party Lua modules.
#
# This file INTENTIONALLY does not run npm. Building React inside Docker
# hammered memory/CPU-constrained hosts. Build the bundle outside Docker first:
#   - If you have Node on the host:      npm ci && npm run build
#   - If you don't:                      ./scripts/build.sh
# Either way, `dist/` must exist before `docker compose build`.
# For the full in-image build, use Dockerfile.full-build instead.
# =========================================================================
FROM openresty/openresty:1.31.1.1-alpine

# ca-certificates: required so the rotator can verify Google's TLS cert
# (proxy_ssl_verify on). This is the only build-time network dependency.
RUN apk add --no-cache ca-certificates tzdata && update-ca-certificates

# Ship our custom files. The rendered server-block fragment lives in /tmp at
# runtime (see entrypoint.sh), so /etc/nginx itself can stay read-only.
COPY docker/nginx/nginx.sectube.conf       /etc/nginx/nginx.sectube.conf
COPY docker/nginx/nginx.conf.template      /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf    /etc/nginx/security-headers.conf
COPY docker/nginx/lua/                      /etc/nginx/lua/
COPY docker/entrypoint.sh                   /docker-entrypoint-sectube.sh
RUN chmod 0755 /docker-entrypoint-sectube.sh

# The prebuilt React bundle.
COPY dist/ /usr/share/nginx/html/

# Run unprivileged. Create a dedicated user; it only needs READ on the html +
# /etc/nginx files and WRITE to /tmp (rendered config, pid, temp paths — tmpfs
# at runtime).
RUN addgroup -S sectube 2>/dev/null || true; \
    adduser -S -G sectube -u 1001 sectube 2>/dev/null || true; \
    chown -R sectube:sectube /usr/share/nginx/html

USER sectube

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

# Invoke via `/bin/sh script` to sidestep any +x / shebang weirdness.
ENTRYPOINT ["/bin/sh", "/docker-entrypoint-sectube.sh"]
