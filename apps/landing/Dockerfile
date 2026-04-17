# Stage 1: Build
FROM node:22-slim AS build
WORKDIR /app

# Copy package files (context is project root)
COPY apps/landing/package.json apps/landing/bun.lockb* ./

# Install dependencies
RUN npm install

# Copy source (context is project root)
COPY apps/landing/ ./

# Build SSR app
RUN npm run build

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
