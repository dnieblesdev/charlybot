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
# Copy package files and install (node_modules persist in container)
COPY apps/dashboard/package.json ./apps/dashboard/
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source
COPY apps/dashboard/ ./

EXPOSE 4201

# Angular dev server with hot reload
CMD ["ng", "serve", "--port", "4201", "--host", "0.0.0.0"]
