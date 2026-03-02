# syntax=docker/dockerfile:1

# ─── Base ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ─── Stage 1: Prune monorepo ──────────────────────────────────────────────────
# turbo prune creates a minimal subset of the repo containing only
# @productpulse/web and its workspace dependencies.
FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo@^2
COPY . .
RUN turbo prune @productpulse/web --docker

# ─── Stage 2: Install dependencies ───────────────────────────────────────────
FROM base AS installer
WORKDIR /app

# Copy pruned package manifests (no source yet — better layer caching)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install — this also runs `postinstall` in packages/db → prisma generate
RUN pnpm install --frozen-lockfile

# ─── Stage 3: Build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy installed node_modules
COPY --from=installer /app/ .
# Copy full source of the pruned workspace
COPY --from=pruner /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1

# Firebase public config — baked into the Next.js bundle at build time
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID

# Build Next.js (turbo runs db:generate first via dependency graph)
RUN pnpm turbo build --filter=@productpulse/web

# ─── Stage 4: Production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone output is self-contained — no node_modules needed
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by Next.js standalone output
CMD ["node", "apps/web/server.js"]
