# Multi-stage build for Bot
# Stage 1: Build dependencies and Prisma
FROM oven/bun:1 AS builder

# Install build tools needed for native modules (ioredis, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-pip \
    python3-setuptools \
    && rm -rf /var/lib/apt/lists/*

# Install ffmpeg + libopus + libsodium for Discord.js voice + yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libsodium23 \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp latest
RUN wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/ ./packages/shared/

# Install dependencies and generate Prisma
RUN bun install --frozen-lockfile
RUN bunx prisma generate

# Stage 2: Runtime
FROM oven/bun:1

# Install build tools needed for native modules (ioredis, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-pip \
    python3-setuptools \
    && rm -rf /var/lib/apt/lists/*

# Install ffmpeg + libopus + libsodium for Discord.js voice + yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libopus0 \
    libsodium23 \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download yt-dlp latest
RUN wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/shared/src/generated /app/packages/shared/src/generated

# Copy source files
COPY apps/bot/ ./apps/bot/
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

CMD ["bun", "run", "--cwd", "/app/apps/bot", "start"]