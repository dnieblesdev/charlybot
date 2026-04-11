# Development image - deps installed at runtime via entrypoint
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

# Copy source files (will be bind-mounted at runtime anyway)
COPY package.json bun.lock ./
COPY apps/bot/ ./apps/bot/
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["bun", "run", "--cwd", "/app/apps/bot", "dev"]
