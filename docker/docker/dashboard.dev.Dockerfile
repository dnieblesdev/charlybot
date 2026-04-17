# Dev Dockerfile for Dashboard — Angular SPA with hot reload
# Build context: project root (..)
# Use: docker compose -f docker/docker-compose.dev.yml
FROM node:22-slim
WORKDIR /app

# Install Angular CLI globally
RUN npm install -g @angular/cli@21

# Copy package files and install (node_modules persist in container)
COPY apps/dashboard/package.json apps/dashboard/bun.lockb* ./
RUN npm install

# Copy source
COPY apps/dashboard/ ./

EXPOSE 4201

# Angular dev server with hot reload
CMD ["npx", "ng", "serve", "--port", "4201", "--host", "0.0.0.0"]
