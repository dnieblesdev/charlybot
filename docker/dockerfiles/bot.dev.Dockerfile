FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    ffmpeg \
    libopus0 \
    libsodium23 \
    curl \
    wget \
    ca-certificates \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp
RUN wget -O /usr/local/bin/yt-dlp \
    https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod 755 /usr/local/bin/yt-dlp

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

COPY apps/bot/package.json ./apps/bot/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/

RUN pnpm install --frozen-lockfile

CMD ["pnpm", "--filter", "@charlybot/bot", "dev"]
