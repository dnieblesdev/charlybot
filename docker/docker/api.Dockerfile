# Multi-stage build for API
FROM oven/bun:1.3.9 AS builder

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

RUN corepack enable

# Copy package files
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile --silent --filter @charlybot/api...

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy source files
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Build: Compile TypeScript to vanilla JS
# @charlybot/shared stays external (workspace reference)
RUN pnpm exec bun build \
    --target=node \
    --outfile=apps/api/dist/index.js \
    --packages=external \
    -e @charlybot/shared \
    -e @prisma/client \
    apps/api/src/index.ts

# Stage 2: Runtime — minimal Node.js runtime
FROM node:22-slim

# OpenSSL for Prisma native binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

RUN corepack enable

# Copy package files for dependency installation
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/

# Install runtime dependencies
RUN pnpm install --frozen-lockfile --silent --ignore-scripts --filter @charlybot/api...

# Generate Prisma client at runtime (so native engines are downloaded for this architecture)
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy compiled output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist/
COPY --from=builder /app/packages/shared/src/generated ./packages/shared/src/generated/

# Copy @charlybot/shared source (needed for workspace resolution of imports)
COPY packages/shared/src/ ./packages/shared/src/

EXPOSE 3000

# Run compiled JS (NOT tsx, NOT TypeScript)
CMD ["node", "apps/api/dist/index.js"]
