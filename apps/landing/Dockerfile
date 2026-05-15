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

# Install dependencies
# Install only landing dependencies (not entire monorepo)
RUN pnpm install --filter @charlybot/landing --frozen-lockfile

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
