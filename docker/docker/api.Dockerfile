# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/

# Instalar dependencias
RUN bun install

# Generar Prisma client
RUN cd packages/shared && bunx prisma generate

# Production slim
FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/apps/ ./apps/
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./

WORKDIR /app

# Exponer puerto 3000
EXPOSE 3000

CMD ["bun", "run", "--cwd", "/app/apps/api", "dev"]