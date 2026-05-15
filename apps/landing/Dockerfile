# Stage 1: Build
FROM node:22-slim AS build
WORKDIR /app

# Copy workspace root for pnpm monorepo context
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy package files (context is project root)
COPY apps/landing/package.json ./apps/landing/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source (context is project root)
COPY apps/landing/ ./

# Build SSR app
RUN pnpm run build

# Stage 2: Runtime
FROM node:22-slim
WORKDIR /app

# Copy built artifacts
COPY --from=build /app/dist/landing /app/dist/landing

# Expose port
EXPOSE 4200

# Start SSR server on port 4200
ENV PORT=4200
CMD ["node", "dist/landing/server/server.mjs"]
