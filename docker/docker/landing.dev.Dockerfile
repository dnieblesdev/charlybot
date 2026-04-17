# Dev Dockerfile for Landing — Angular SSR with hot reload
# Build context: project root (..)
# Use: docker compose -f docker/docker-compose.dev.yml
FROM node:22-slim
WORKDIR /app

# Install Angular CLI globally
RUN npm install -g @angular/cli@21

# Copy package files and install (node_modules persist in container)
COPY apps/landing/package.json apps/landing/bun.lockb* ./
RUN npm install

# Copy source
COPY apps/landing/ ./

EXPOSE 4200

# Angular dev server with hot reload
CMD ["npx", "ng", "serve", "--port", "4200", "--host", "0.0.0.0"]
