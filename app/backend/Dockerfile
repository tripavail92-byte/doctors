# Health OS backend — production image.
#
# Build from the REPO ROOT so the root .dockerignore applies:
#   docker build -f app/backend/Dockerfile -t healthos-backend .
#
# Building from app/backend/ instead would use a context with no .dockerignore
# and bake .env into the image. The path in the -f flag is the guard.

# ---------------------------------------------------------------------------
# deps — install once, reuse for build and runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY app/backend/package*.json ./
# `npm ci` needs the lockfile and installs devDependencies too; the build needs
# them (nest, typescript, prisma CLI) and they are dropped in the final stage.
RUN npm ci

# ---------------------------------------------------------------------------
# build — compile TypeScript and generate the Prisma client
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY app/backend/ ./
# The generated client is architecture-specific, so it must be produced in the
# image rather than copied from the host.
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# migrate — schema + RLS + seed. NOT the app image.
# ---------------------------------------------------------------------------
# `prisma` and `ts-node` are devDependencies, so the runtime image cannot apply a
# schema even if asked. That separation is deliberate: the app connects as
# healthos_app (NOSUPERUSER NOBYPASSRLS) and must never hold the credentials that
# could alter the schema. Run this stage as a one-shot job with the OWNER
# credentials, then start the runtime image.
#
#   docker build -f app/backend/Dockerfile --target migrate -t healthos-migrate .
#   docker run --rm -e DIRECT_DATABASE_URL=... -e DATABASE_URL=... healthos-migrate
FROM build AS migrate
WORKDIR /app
RUN apk add --no-cache postgresql16-client
COPY app/backend/prisma/ ./prisma/
CMD ["sh", "-c", "set -e; \
  npx prisma db push --skip-generate; \
  for f in prisma/rls.sql prisma/rls-roles.sql prisma/rls-user.sql prisma/constraints.sql; do \
    echo \"--- $f\"; \
    psql -v ON_ERROR_STOP=1 \"$(node -e \"const u=new URL(process.env.DIRECT_DATABASE_URL);u.searchParams.delete('schema');console.log(u.toString())\")\" -f \"$f\"; \
  done; \
  npx ts-node prisma/seed.ts; \
  echo '--- verifying tenant isolation is actually enforced'; \
  npx ts-node scripts/check-rls-live.ts"]

# ---------------------------------------------------------------------------
# runtime — the app, and nothing that can alter a schema
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# UTC, not merely conventional. Prisma reads/writes `timestamp WITHOUT TIME ZONE`
# as UTC while raw SQL now() uses the session zone; the app refuses to boot if
# the DATABASE session is not UTC (PrismaService.assertUtcSession). Matching the
# container keeps logs and the database telling the same story.
ENV TZ=UTC
ENV NODE_ENV=production

# Patient photos. StorageService defaults to ./uploads — inside the container's
# writable layer, which is destroyed on redeploy while the PhotoAsset rows in
# Postgres survive, leaving the chart referencing bytes that no longer exist.
# Point it at a mount, and mount it on the FIRST deploy: retrofitting after
# photos exist means those photos are already gone.
ENV STORAGE_DIR=/data/uploads

COPY app/backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY app/backend/public ./public
COPY app/backend/prisma/schema.prisma ./prisma/schema.prisma

# Non-root. The app never needs to write to its own filesystem — uploads go to
# the mounted volume.
RUN addgroup -S healthos && adduser -S healthos -G healthos \
 && mkdir -p /data/uploads && chown -R healthos:healthos /data
USER healthos

EXPOSE 3000

# Readiness, not liveness: /health/ready proves the database is reachable AND
# that tenant isolation is enforceable. A plain liveness probe would route
# traffic to an instance that cannot reach Postgres.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
