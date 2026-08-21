# Coolify / production image for Uhired (Next.js standalone)
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
# VPS builds can hit transient npm registry drops (ECONNRESET) — retry downloads.
# Coolify often injects NODE_ENV=production at build time; --include=dev keeps
# Tailwind/PostCSS/TypeScript available for `next build`.
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm ci --include=dev --no-audit --no-fund

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public env (set these as Coolify "Build Variables" / ARG)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_INTERVIEW_DURATION_SEC
ARG NEXT_PUBLIC_PAYMENTS_ENABLED
ARG NEXT_PUBLIC_INTERVIEW_PRICE_PAISE
ARG NEXT_PUBLIC_INTERVIEW_CURRENCY
# Placeholder so `next build` can load env.ts during page-data collection.
# Coolify may override via build args; runtime env supplies the real DB URL.
ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ARG DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    NEXT_PUBLIC_INTERVIEW_DURATION_SEC=$NEXT_PUBLIC_INTERVIEW_DURATION_SEC \
    NEXT_PUBLIC_PAYMENTS_ENABLED=$NEXT_PUBLIC_PAYMENTS_ENABLED \
    NEXT_PUBLIC_INTERVIEW_PRICE_PAISE=$NEXT_PUBLIC_INTERVIEW_PRICE_PAISE \
    NEXT_PUBLIC_INTERVIEW_CURRENCY=$NEXT_PUBLIC_INTERVIEW_CURRENCY \
    DATABASE_URL=$DATABASE_URL \
    DIRECT_URL=$DIRECT_URL

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files (--chown avoids a final chown -R over node_modules, which OOMs on small VPS builders)
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma

# Prisma client + engines for the running app (generated in builder)
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Isolated Prisma CLI + full dependency tree for migrate deploy (avoids standalone npm conflicts)
COPY --chown=nextjs:nodejs --from=deps /app/node_modules /prisma-tools/node_modules

COPY --chown=nextjs:nodejs --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=nextjs:nodejs --from=builder /app/scripts/baseline-migrations.mjs ./scripts/baseline-migrations.mjs
COPY --chown=nextjs:nodejs --from=builder /app/scripts/import-sqltables.mjs ./scripts/import-sqltables.mjs
COPY --chown=nextjs:nodejs --from=builder /app/scripts/coolify-db-baseline.sh ./scripts/coolify-db-baseline.sh
COPY --chown=nextjs:nodejs --from=builder /app/scripts/coolify-db-import.sh ./scripts/coolify-db-import.sh
COPY --chown=nextjs:nodejs --from=builder /app/sqltables ./sqltables
RUN chmod +x docker-entrypoint.sh scripts/coolify-db-baseline.sh scripts/coolify-db-import.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
