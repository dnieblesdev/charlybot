# Dev Dockerfile for Landing — Angular SSR with hot reload
# Build context: project root (..)
# Use: docker compose -f docker/docker-compose.dev.yml
FROM node:22-slim
WORKDIR /app

# Install Angular CLI globally
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
RUN corepack enable && pnpm add -g @angular/cli@21

# Copy workspace root for pnpm
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
# Copy ALL workspace package.json files (pnpm needs complete workspace to resolve)
COPY apps/landing/package.json ./apps/landing/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Copy source to the correct workspace subdirectory
COPY apps/landing/ ./apps/landing/

WORKDIR /app/apps/landing
EXPOSE 4200

# Angular dev server with hot reload
CMD ["ng", "serve", "--port", "4200", "--host", "0.0.0.0"]
