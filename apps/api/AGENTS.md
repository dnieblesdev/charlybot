# AGENTS.md — Charly API (`apps/api`)

Contexto para agentes de IA trabajando en la API. Leelo completo antes de generar cambios.

## TL;DR

- Runtime: **Bun** (`bun --hot`).
- Framework: **Hono**.
- Validación: **zod** + `@hono/zod-validator`.
- Logs: **Winston** (`src/utils/logger.ts`).
- DB: Prisma via `@charlybot/shared` (SQLite/LibSQL adapter). Default: `packages/shared/dev.db`.
- Auth: `X-API-Key` en `/api/*` (middleware); `API_KEY` es obligatoria y se valida al importar el módulo.

## Comandos

```bash
# desde apps/api
bun run dev

# desde la raíz
bun run dev:api
```

## Entry Point

`src/index.ts`:

- `new Hono()`.
- Middleware de logging global (`app.use("*", ...)`).
- `GET /health` público (incluye check simple a DB con `prisma.$queryRaw`).
- Protege `/api/*` con `authMiddleware`.
- Monta routers bajo `/api/v1/...`.
- Exporta `default { port, fetch }` (server de Bun).

## Estructura

```
src/
  index.ts
  routes/
    guilds.ts
    economy.ts
    xp.ts
    autoroles.ts
    verifications.ts
    classes.ts
    music.ts
  middleware/
    authMiddleware.ts
  infrastructure/
    valkey/
      index.ts
  services/
    music-queue-cache.service.ts
  utils/
    logger.ts
tests/
  setup.ts
  (tests por feature)
```

## Do / Don’t (Agentes)

### Do

- Reutilizá schemas y tipos desde `@charlybot/shared`.
- Usá `zValidator(...)` para inputs.
- Para operaciones sensibles a race conditions, preferí `prisma.$transaction(...)`.
- Logueá errores con contexto y devolvé JSON consistente.

### Don’t

- No agregues rutas nuevas fuera de `/api/v1/...`.
- No saltees `authMiddleware` para rutas no públicas.
- No olvides que `API_KEY` es requerida: el módulo falla al importar si falta.

## Auth

`src/middleware/authMiddleware.ts`:

- Lee `process.env.API_KEY` al importar el archivo y **lanza error** si no existe.
- Valida el header `X-API-Key`.

Implicancia: en tests/scripts, seteá `API_KEY` antes de importar `src/index.ts`.
En tests ya existe `tests/setup.ts` con un default.

## DB (Prisma)

- Import: `import { prisma } from "@charlybot/shared"`.
- Config: `packages/shared/src/prisma.ts`.
- Default: `packages/shared/dev.db` si `DATABASE_URL` no está.

## Valkey

`src/infrastructure/valkey/index.ts` inicializa cliente Valkey usando utilidades de `@charlybot/shared`.
Tiene fallback in-memory por si Valkey no conecta.

## Variables De Entorno (mínimas)

- `API_KEY` (requerida)
- `PORT` (default 3000)
- `LOG_LEVEL` (default "info")
- `DATABASE_URL` (opcional)
- `VALKEY_*`
