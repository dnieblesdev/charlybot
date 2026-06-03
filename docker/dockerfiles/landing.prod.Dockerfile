# Stage 1: Build
FROM node:22-slim AS build
WORKDIR /app

# Enable corepack and install Angular CLI globally
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN corepack enable && pnpm add -g @angular/cli@21

# Copy workspace root for pnpm monorepo context
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy ALL workspace package.json files (pnpm needs complete workspace to resolve)
COPY apps/landing/package.json ./apps/landing/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (full workspace — builder stage is discarded)
RUN pnpm install --frozen-lockfile

# Copy source to the correct workspace subdirectory
COPY apps/landing/ ./apps/landing/

# Build SSR app from within the landing directory
WORKDIR /app/apps/landing
RUN pnpm run build

# Stage 2: Runtime
FROM node:22-slim
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built artifacts (output is at apps/landing/dist/landing/)
COPY --from=build /app/apps/landing/dist/landing /app/dist/landing

# Copy node_modules for SSR runtime dependencies
# SSR may need some runtime node_modules — copy the whole workspace node_modules
COPY --from=build /app/node_modules ./node_modules

# Set production env
ENV NODE_ENV=production

# Expose port
EXPOSE 4200

# Start SSR server on port 4200
ENV PORT=4200
CMD ["node", "dist/landing/server/server.mjs"]
