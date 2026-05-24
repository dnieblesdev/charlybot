# Dev Dockerfile for Landing — Angular SSR with hot reload
# Build context: project root (..)
# Use: docker compose -f docker/docker-compose.dev.yml
FROM node:22-slim

# Install OpenSSL to silence Prisma engine detection warnings
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root for pnpm
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# Copy only needed workspace package.json files for landing
COPY apps/landing/package.json ./apps/landing/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile --silent --ignore-scripts

# Copy source to the correct workspace subdirectory
COPY apps/landing/ ./apps/landing/

WORKDIR /app/apps/landing
EXPOSE 4200

# Angular dev server with hot reload via pnpm exec
CMD ["pnpm", "exec", "ng", "serve", "--port", "4200", "--host", "0.0.0.0", "--poll", "2000"]
