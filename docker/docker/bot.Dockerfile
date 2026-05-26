# Multi-stage build for Bot
# Stage 1: Build TypeScript with Node.js + Bun bundler
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (needed for bundling, not available in node:22-slim)
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Enable corepack so pnpm is available
RUN corepack enable

# Copy package files for dependency installation
COPY apps/bot/package.json ./apps/bot/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY apps/api/package.json ./apps/api/

# Install dependencies (includes native modules build for discordjs/opus, sodium-native)
RUN pnpm install --frozen-lockfile --silent --filter @charlybot/bot...

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy source files
COPY apps/bot/ ./apps/bot/
COPY packages/shared/ ./packages/shared/

# Build: Compile TypeScript to vanilla JS
# Native modules are kept external (will be loaded from node_modules at runtime)
RUN pnpm exec bun build \
    --target=node \
    --outfile=apps/bot/dist/index.js \
    --packages=external \
    -e play-opus \
    -e @discordjs/opus \
    -e opusscript \
    -e sodium-native \
    -e @charlybot/shared \
    -e @prisma/client \
    apps/bot/src/index.ts

# Stage 2: Runtime — minimal Node.js runtime
FROM node:22-slim

# Runtime dependencies for Discord.js voice + yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libsodium23 \
    ca-certificates \
    wget \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp latest (standalone binary)
RUN wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

# Copy workspace root files for node_modules resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Enable corepack for pnpm
RUN corepack enable

# Copy package files for dependency installation (runtime stage — no build tools needed)
COPY apps/bot/package.json ./apps/bot/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY apps/api/package.json ./apps/api/

# Install dependencies (runtime only — no build tools needed)
# --ignore-scripts skips native module compilation since we won't have compilers in runtime
RUN pnpm install --frozen-lockfile --silent --ignore-scripts --filter @charlybot/bot...

# Copy Prisma client (needed at runtime for database queries via @charlybot/shared)
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy compiled output and shared package source from builder
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist/
COPY --from=builder /app/packages/shared/src/generated ./packages/shared/src/generated/
COPY packages/shared/src/ ./packages/shared/src/

# Copy bot source (needed at runtime for --packages=external resolution)
COPY apps/bot/src ./apps/bot/src/

# Run the compiled JavaScript (NOT tsx, NOT TypeScript)
CMD ["node", "apps/bot/dist/index.js"]
