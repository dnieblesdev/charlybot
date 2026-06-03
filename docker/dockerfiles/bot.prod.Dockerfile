# =========================================================
# Stage 1: Builder
# =========================================================
FROM node:22-bookworm AS builder

# Native build tooling required for:
# - @discordjs/opus
# - play-opus
# - sodium-native
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    curl \
    ca-certificates \
    unzip \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (only used for bundling)
RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# =========================================================
# Workspace metadata
# =========================================================
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Package manifests
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Prisma schema
COPY packages/shared/prisma ./packages/shared/prisma/

# =========================================================
# Install dependencies
# =========================================================
RUN pnpm install --frozen-lockfile --filter @charlybot/bot...

# =========================================================
# Copy source code
# =========================================================
COPY apps/bot ./apps/bot
COPY packages/shared ./packages/shared

# =========================================================
# Generate Prisma client
# =========================================================
RUN pnpm exec prisma generate \
    --schema=./packages/shared/prisma/schema.prisma

# =========================================================
# Build bot
# =========================================================
RUN bun build \
    --target=node \
    --outfile=apps/bot/dist/index.js \
    --packages=external \
    --external play-opus \
    --external @discordjs/opus \
    --external opusscript \
    --external sodium-native \
    --external @charlybot/shared \
    --external @prisma/client \
    apps/bot/src/index.ts

# =========================================================
# Stage 2: Runtime
# =========================================================
FROM node:22-bookworm-slim AS runtime

# Runtime libraries only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libsodium23 \
    ca-certificates \
    wget \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp
RUN wget -O /usr/local/bin/yt-dlp \
    https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

ENV NODE_ENV=production

# =========================================================
# Copy runtime artifacts from builder
# =========================================================

# Production dependencies + compiled native modules
COPY --from=builder /app/node_modules ./node_modules

# Workspace metadata
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Built application
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist

# Package manifests (needed for workspace resolution)
COPY --from=builder /app/apps/bot/package.json ./apps/bot/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Prisma generated client
COPY --from=builder /app/packages/shared/prisma ./packages/shared/prisma
COPY --from=builder /app/packages/shared/src/generated ./packages/shared/src/generated

# Shared runtime source (if imported dynamically)
COPY --from=builder /app/packages/shared/src ./packages/shared/src

# =========================================================
# Start bot
# =========================================================
CMD ["node", "apps/bot/dist/index.js"]
