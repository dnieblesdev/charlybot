# Single-stage build for Bot
# pnpm virtual store + native modules don't survive multi-stage COPY
FROM node:22-slim

# Install build tools for native modules (sodium-native, opus, ioredis)
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

# Download yt-dlp latest (standalone binary)
RUN wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy workspace root and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/
COPY apps/api/package.json ./apps/api/

# Install dependencies (build tools present → native modules compile)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy source files
COPY apps/bot/ ./apps/bot/
COPY packages/shared/ ./packages/shared/

# Run with tsx (executes TypeScript natively)
CMD ["pnpm", "--filter", "@charlybot/bot", "dev"]
