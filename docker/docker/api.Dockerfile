# Single-stage build for API
# pnpm virtual store + Prisma generated client don't survive multi-stage COPY
FROM node:22-slim

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy workspace root and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY apps/bot/package.json ./apps/bot/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Copy source files
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

EXPOSE 3000

# Uses "start" script from apps/api/package.json
CMD ["pnpm", "--filter", "@charlybot/api", "start"]
