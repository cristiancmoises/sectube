# syntax=docker/dockerfile:1.7
# =========================================================================
# Lean image: just nginx + the prebuilt dist/ directory.
#
# This file INTENTIONALLY does not run npm. Building React inside Docker
# hammered memory/CPU-constrained hosts and was failing with npm's
# "Exit handler never called!" OOM-adjacent error.
#
# The build now happens outside Docker:
#   - If you have Node on the host:      npm ci && npm run build
#   - If you don't:                      ./scripts/build.sh  (runs a one-off
#                                        node:22-slim container to build,
#                                        outputs to ./dist on your host)
#
# Either way, `dist/` must exist before `docker compose build`.
# If you WANT the full in-image build, use Dockerfile.full-build instead.
# =========================================================================
FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root

# Remove the default conf.d entry — we drive nginx via our own main config.
RUN rm -f /etc/nginx/conf.d/default.conf

# Ship our custom files under /etc/nginx. The rendered server-block fragment
# lives in /tmp at runtime (see entrypoint.sh), so /etc/nginx itself can stay
# read-only without problems.
COPY docker/nginx/nginx.sectube.conf /etc/nginx/nginx.sectube.conf
COPY docker/nginx/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/entrypoint.sh /docker-entrypoint-sectube.sh
# chmod is belt; we invoke via `/bin/sh` below (suspenders) so even if the
# +x bit is stripped by some filesystem along the way, the script still runs.
RUN chmod 0755 /docker-entrypoint-sectube.sh

# The prebuilt React bundle.
COPY dist/ /usr/share/nginx/html/

# nginx user only needs to READ the html + /etc/nginx files. It writes only
# to /tmp (rendered config, pid, temp paths), which is tmpfs at runtime.
RUN chown -R nginx:nginx /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

# Invoke via `/bin/sh script` instead of `./script`. This sidesteps any
# combination of +x weirdness, shebang interpretation, and the
# `no-new-privileges: true` security_opt that can refuse to exec a script
# directly under nginx-unprivileged. `sh` reads the file as input — no
# privilege transition involved, no exec-of-script semantics, always works.
ENTRYPOINT ["/bin/sh", "/docker-entrypoint-sectube.sh"]
