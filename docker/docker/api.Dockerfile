# Single-stage build for API
# pnpm virtual store + Prisma generated client don't survive multi-stage COPY
FROM node:22-slim

# Install OpenSSL to silence Prisma engine detection warnings
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files FIRST so corepack can read packageManager version
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Enable corepack for pnpm — now it reads packageManager from package.json
RUN corepack enable
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/

# Install dependencies — skip lifecycle scripts to avoid compiling
# bot-only native modules (@discordjs/opus, play-opus) that the API doesn't use.
# Prisma engines are downloaded manually via `prisma generate` below.
RUN pnpm install --frozen-lockfile --silent --ignore-scripts

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy source files
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

EXPOSE 3000

# Uses "start" script from apps/api/package.json
CMD ["pnpm", "--filter", "@charlybot/api", "start"]
