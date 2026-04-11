# Multi-stage build for API
# Stage 1: Build dependencies and Prisma
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/ ./packages/shared/

# Install dependencies and generate Prisma
RUN bun install
RUN bunx prisma generate --schema=./packages/shared/prisma/schema.prisma

# Stage 2: Runtime
# NOTE: Production-ready — minimal runtime with only API service
FROM oven/bun:1

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/shared/src/generated /app/packages/shared/src/generated

# Copy source files
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

EXPOSE 3000

# Uses "start" script from apps/api/package.json
CMD ["bun", "run", "--cwd", "/app/apps/api", "start"]
