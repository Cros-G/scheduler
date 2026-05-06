# syntax=docker/dockerfile:1.6

# ---- deps stage -------------------------------------------------------
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Use hoisted node-linker so packages land directly in node_modules (not pnpm virtual store).
# This avoids symlink resolution issues when copying to the runner stage.
RUN corepack enable \
 && echo "node-linker=hoisted" > .npmrc \
 && pnpm install --frozen-lockfile

# ---- builder stage ----------------------------------------------------
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm exec prisma generate
RUN pnpm exec next build

# ---- runner stage -----------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl sqlite tini
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
ENV DATABASE_URL=file:/data/scheduler.db
ENV TZ=Asia/Shanghai

# Standalone output (server.js + minimal node_modules)
COPY --from=builder /app/.next/standalone ./
# Static assets (not in standalone by default)
COPY --from=builder /app/.next/static ./.next/static

# Prisma runtime: client + engine + migrations + CLI for migrate deploy
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
# Transitive deps of prisma CLI (@prisma/config -> effect, empathic, fast-check, pure-rand)
COPY --from=builder /app/node_modules/effect ./node_modules/effect
COPY --from=builder /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder /app/node_modules/pure-rand ./node_modules/pure-rand
# c12 and deepmerge-ts (used by @prisma/config for config file loading) + full transitive closure
COPY --from=deps /app/node_modules/c12 ./node_modules/c12
COPY --from=deps /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=deps /app/node_modules/pathe ./node_modules/pathe
COPY --from=deps /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=deps /app/node_modules/jiti ./node_modules/jiti
COPY --from=deps /app/node_modules/rc9 ./node_modules/rc9
COPY --from=deps /app/node_modules/defu ./node_modules/defu
COPY --from=deps /app/node_modules/destr ./node_modules/destr
COPY --from=deps /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=deps /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=deps /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=deps /app/node_modules/confbox ./node_modules/confbox
COPY --from=deps /app/node_modules/ohash ./node_modules/ohash
COPY --from=deps /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=deps /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=deps /app/node_modules/giget ./node_modules/giget
COPY --from=deps /app/node_modules/citty ./node_modules/citty
COPY --from=deps /app/node_modules/consola ./node_modules/consola
COPY --from=deps /app/node_modules/node-fetch-native ./node_modules/node-fetch-native
COPY --from=deps /app/node_modules/nypm ./node_modules/nypm
COPY --from=deps /app/node_modules/tinyexec ./node_modules/tinyexec

# tsx for seed CLIs (scripts/seed-user.ts, scripts/reset-password.ts)
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx

# Scripts (seed-user / reset-password)
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/password.ts ./src/lib/password.ts

# Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Volume mount target
RUN mkdir -p /data

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
