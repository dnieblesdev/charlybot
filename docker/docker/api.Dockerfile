# Multi-stage build for API
# Stage 1: Build dependencies and Prisma
FROM node:22-slim AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/ ./packages/shared/

# Install dependencies and generate Prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate --schema=./packages/shared/prisma/schema.prisma

# Stage 2: Runtime
# NOTE: Production-ready — minimal runtime with only API service
FROM node:22-slim

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy built artifacts from builder
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/shared/src/generated /app/packages/shared/src/generated

# Copy source files
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

EXPOSE 3000

# Uses "start" script from apps/api/package.json
CMD ["pnpm", "--filter", "@charlybot/api", "start"]