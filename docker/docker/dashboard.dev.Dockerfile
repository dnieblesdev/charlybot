# Dev Dockerfile for Dashboard — Angular SPA with hot reload
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
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/landing/package.json ./apps/landing/
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Copy source to the correct workspace subdirectory
COPY apps/dashboard/ ./apps/dashboard/

WORKDIR /app/apps/dashboard
EXPOSE 4201

# Angular dev server with hot reload
CMD ["ng", "serve", "--port", "4201", "--host", "0.0.0.0"]
