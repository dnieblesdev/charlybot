# Multi-stage build for Bot
# Stage 1: Build dependencies and Prisma
FROM oven/bun:1 AS builder

# Install build tools needed for native modules (ioredis, sodium-native, opus)
# These are NOT copied to runtime — only needed during build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-pip \
    python3-setuptools \
    && rm -rf /var/lib/apt/lists/*

# Install runtime dependencies for Discord.js voice + yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libsodium23 \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp latest (standalone binary, no Python needed)
RUN wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files — bot + shared only (no api)
COPY package.json bun.lock ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/shared/ ./packages/shared/

# Install dependencies and generate Prisma
RUN bun install
RUN bunx prisma generate --schema=./packages/shared/prisma/schema.prisma

# Stage 2: Runtime
# NOTE: Production-ready — no build tools included
FROM oven/bun:1

# Install runtime dependencies only (ffmpeg, opus, yt-dlp)
# build-essential, python3 are NOT included — saves ~150MB+
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libsodium23 \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp latest (standalone binary, no Python needed)
RUN wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/shared/src/generated /app/packages/shared/src/generated

# Copy source files — bot + shared only (no api)
# Bot consumes API via HTTP (adapters in apps/bot/src/infrastructure/api/*)
COPY apps/bot/ ./apps/bot/
COPY packages/shared/ ./packages/shared/

# Run directly with Bun (no build needed — Bun executes TypeScript natively)
CMD ["bun", "run", "--cwd", "/app/apps/bot", "src/index.ts"]
