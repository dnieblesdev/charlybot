# Development image - deps installed at runtime via entrypoint
FROM oven/bun:1

WORKDIR /app

# Copy source files (will be bind-mounted at runtime anyway)
COPY package.json bun.lock ./
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

CMD ["bun", "run", "--cwd", "/app/apps/api", "dev"]