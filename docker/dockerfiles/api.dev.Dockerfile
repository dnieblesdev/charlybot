FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/prisma ./packages/shared/prisma/

RUN pnpm install --frozen-lockfile --filter @charlybot/api...
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

CMD ["pnpm", "--filter", "@charlybot/api", "dev"]
