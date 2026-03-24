# Build stage
FROM oven/bun:1 AS builder

# Install build tools needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos del monorepo
COPY package.json bun.lock ./
COPY apps/bot/ ./apps/bot/
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Instalar dependencias (--ignore-scripts para skip compilación de @discordjs/opus)
RUN bun install --ignore-scripts

# Generar Prisma client
RUN cd packages/shared && bunx prisma generate

# Production slim image
FROM oven/bun:1-slim

# Install ffmpeg + libsodio para Discord.js voice + yt-dlp
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

# Copy lo necesario del builder
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/apps/ ./apps/
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

WORKDIR /app

# Crear directorio bin y symlink para yt-dlp
# El código busca bin/yt-dlp.exe, usamos symlink al binary real
RUN mkdir -p /app/bin && \
    ln -sf /usr/local/bin/yt-dlp /app/bin/yt-dlp.exe

# El bot no necesita expose porque no expose puertos - corre como servicio
CMD ["bun", "run", "--cwd", "/app/apps/bot", "dev"]