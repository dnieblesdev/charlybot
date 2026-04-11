#!/bin/bash
set -e

# Runtime dependency installation for Bun monorepo dev workflow
# Installs deps into container filesystem after bind mounts

echo "[entrypoint] Starting runtime dependency installation..."

# Install root workspace dependencies
echo "[entrypoint] Installing root workspace deps..."
bun install --cwd /app

# Install shared package dependencies (each package needs its own node_modules)
if [ -d "/app/packages/shared" ]; then
    echo "[entrypoint] Installing shared package deps..."
    bun install --cwd /app/packages/shared
fi

# Install app-specific dependencies if different from root
if [ -d "/app/apps/api" ] && [ -f "/app/apps/api/package.json" ]; then
    echo "[entrypoint] Installing API app deps..."
    bun install --cwd /app/apps/api
fi

if [ -d "/app/apps/bot" ] && [ -f "/app/apps/bot/package.json" ]; then
    echo "[entrypoint] Installing bot app deps..."
    bun install --cwd /app/apps/bot
fi

# Generate Prisma client if needed
if [ -d "/app/packages/shared" ]; then
    echo "[entrypoint] Generating Prisma client..."
    bunx prisma generate --cwd /app/packages/shared --schema /app/packages/shared/prisma/schema.prisma 2>/dev/null || true
fi

echo "[entrypoint] Dependency installation complete!"

# Execute the original command (passed via CMD)
exec "$@"