# 🔌 CharlyBot API

API REST del ecosistema CharlyBot. Provee datos al bot de Discord y al dashboard vía HTTP.

## 🚀 Inicio Rápido

```bash
# Desde apps/api
bun install
bun run dev           # http://localhost:3000

# Desde la raíz del monorepo
bun run dev:api
```

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| Runtime | Bun |
| Framework HTTP | Hono |
| Validación | Zod + `@hono/zod-validator` |
| Base de datos | SQLite (Prisma + LibSQL adapter) |
| Cache / Locks | Valkey (Redis-compatible) |
| Logs | Winston |

## 📁 Estructura

```
src/
  index.ts                  ← Entry point, Hono app, middlewares y montaje de rutas
  routes/                   ← Endpoints REST por feature
    guilds.ts               ← Configuración de servidores
    economy.ts              ← Wallet, banco, trabajo, crimen, ruleta
    xp.ts                   ← Sistema de experiencia y niveles
    autoroles.ts            ← Roles automáticos
    verifications.ts        ← Verificación de usuarios
    classes.ts              ← Sistema de clases jerárquico
    music.ts                ← Colas y streams de música
  middleware/
    authMiddleware.ts       ← X-API-Key header requerido en /api/*
  infrastructure/
    valkey/                 ← Cliente Valkey con fallback
  services/
    music-queue-cache.service.ts
  utils/
    logger.ts               ← Winston logger
```

## 🔐 Auth

Todas las rutas bajo `/api/*` requieren el header `X-API-Key` con el valor de `API_KEY`.

```bash
curl -H "X-API-Key: tu-api-key" http://localhost:3000/api/v1/health
```

## 📡 Endpoints Principales

| Ruta | Descripción |
|---|---|
| `GET /health` | Liveness probe público (sin auth) |
| `GET /api/v1/health` | Health check completo (DB + Valkey, con auth) |
| `GET /api/v1/economy/:guildId/:userId` | Wallet de un usuario |
| `POST /api/v1/economy/:guildId/transfer` | Transferencia entre wallets |
| `POST /api/v1/economy/:guildId/work` | Trabajo diario |
| `GET /api/v1/music/:guildId/queue` | Cola de música |
| `GET /api/v1/verifications/:guildId` | Verificaciones pendientes |

## 🐳 Docker

```bash
# Desarrollo (con hot reload)
docker compose -f docker/docker-compose.dev.yml up api

# Producción
docker compose -f docker/docker-compose.yml up -d api
```

## 🔧 Variables de Entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `API_KEY` | ✅ | — | Clave de autenticación (valida al importar) |
| `PORT` | | `3000` | Puerto HTTP |
| `DATABASE_URL` | | `file:./dev.db` | Ruta de SQLite |
| `VALKEY_HOST` | | `valkey` | Host de Valkey |
| `VALKEY_PORT` | | `6379` | Puerto de Valkey |
| `LOG_LEVEL` | | `info` | Nivel de logs: debug, info, warn, error |

## 🧪 Tests

```bash
bun test               # Vitest (unitarios)
bun run test:watch     # Watch mode
bun run test:coverage  # Coverage report
```
