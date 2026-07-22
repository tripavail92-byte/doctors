# Health OS web — production image.
#
# Build from the REPO ROOT so the root .dockerignore applies:
#   docker build -f app/web/Dockerfile -t healthos-web .
#
# This image is nginx serving a static bundle, plus the ONE piece of routing the
# SPA cannot live without: /api proxied to the backend with the prefix stripped.
# In development vite.config.ts does that. Nothing did it in production, so the
# frontend had no deployment path at all — the compose stack brought up a
# database and an API and then had nowhere to put the application.

# ---------------------------------------------------------------------------
# build — typecheck, test, bundle
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY app/web/package*.json ./
RUN npm ci
COPY app/web/ ./
# `npm run build` is `tsc && vite build`, so a type error fails the image rather
# than shipping a bundle that was never typechecked.
RUN npm run build

# ---------------------------------------------------------------------------
# runtime — nginx, static bundle, /api proxy
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

ENV TZ=UTC

# Where to find the API. Overridable so the same image works against a sidecar
# container, a separate host, or a local run.
#
# The nginx config uses a variable for proxy_pass (not a literal), which forces
# re-resolution on every request via the `resolver` directive. The resolver
# address is extracted from /etc/resolv.conf at container start by the .envsh
# script below. This means API redeployments (new IP) are picked up within 10s
# without needing to redeploy web.
ENV API_ORIGIN=http://api:3000

# The port nginx binds. Railway overrides this at run time.
ENV PORT=8080

COPY --from=build /app/dist /usr/share/nginx/html
COPY app/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY app/web/10-set-resolver.envsh /docker-entrypoint.d/10-set-resolver.envsh
RUN chmod +x /docker-entrypoint.d/10-set-resolver.envsh

# nginx:alpine substitutes ${VARS} in /etc/nginx/templates/*.template at startup,
# so API_ORIGIN is read at RUN time, not baked in at build time. One image, any
# environment.

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
