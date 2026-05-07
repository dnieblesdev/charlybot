# AGENTS.md — Charly API (`apps/api`)

Contexto para agentes de IA trabajando en la API. Leelo completo antes de generar cambios.

## Scope Rule

- Used 2+ workspaces → `packages/shared/`
- Used only in bot → `apps/bot/src/`
- Used only in api → `apps/api/src/`

## CRITICAL RULES

### ALWAYS

| # | Rule | Why |
|---|------|-----|
| 1 | Use `zValidator(...)` from `@hono/zod-validator` for all input validation | Enforces Zod schemas at the route layer |
| 2 | Apply `authMiddleware` to all `/api/*` routes (except `/api/v1/auth`) | API_KEY is the only auth mechanism |
| 3 | Use `prisma.$transaction(...)` for race-condition-sensitive operations | Prevents double-spend / concurrent writes |
| 4 | Log errors with context via `logger.error()` | Structured logging for debugging |
| 5 | Return consistent JSON: `{ status, message, data?, error? }` | API consumers expect this shape |
| 6 | Reuse schemas from `@charlybot/shared/schemas/*` | Single source of truth for types |

### NEVER

| # | Rule | Consequence |
|---|------|-------------|
| 1 | Add routes outside `/api/v1/` | Breaks the routing convention and auth coverage |
| 2 | Skip `authMiddleware` for non-public routes | API_KEY validation is mandatory |
| 3 | Run tests without explicit user permission | Tests modify DB state and may affect running services |
| 4 | Import `prisma` outside route/service files | Keep data access in route handlers and services; no direct Prisma in middleware or utils |
| 5 | Return raw error messages from catch blocks | Exposes internal implementation to clients |

## TL;DR

- Runtime: **Bun** (`bun --hot`).
- Framework: **Hono**.
- Validación: **zod** + `@hono/zod-validator`.
- Logs: **Winston** (`src/utils/logger.ts`).
- DB: Prisma via `@charlybot/shared` (LibSQL adapter). Default: `packages/shared/dev.db`.
- Auth: `X-API-Key` header required for all `/api/*` routes.
- Metrics: Prometheus endpoint at `GET /metrics` (line 40 of `src/index.ts`).

## Tech Stack

| | |
|---|---|
| Runtime | Bun |
| Framework | Hono |
| Validation | Zod + `@hono/zod-validator` |
| Logger | Winston (`src/utils/logger.ts`) |
| Metrics | prom-client via `createMetricsRegistry()` |
| DB | Prisma (LibSQL adapter) via `@charlybot/shared` |

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
- `GET /metrics` público (Prometheus scrape endpoint).
- Protege `/api/*` con `authMiddleware`.
- Monta routers bajo `/api/v1/...`.
- `GET /api/v1/health` autenticado con DB + Valkey checks.
- Exporta `default { port, fetch }` (server de Bun).

## Estructura

```
src/
  index.ts                   ← Hono app + middleware + routes
  routes/
    guilds.ts
    economy.ts
    economy.routes.ts        ← alternativa/split
    xp.ts
    autoroles.ts
    verifications.ts
    classes.ts
    music.ts
    auth.ts                  ← público (no auth middleware)
  middleware/
    authMiddleware.ts        ← valida X-API-Key
    rateLimitMiddleware.ts
  infrastructure/
    valkey/
      index.ts               ← Valkey client + fallback
  services/
    music-queue-cache.service.ts
  utils/
    logger.ts                ← Winston
tests/
  setup.ts                   ← API_KEY seteada por defecto
  (tests por feature)
```

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

**Importante**: Tanto la API como el bot usan Prisma directamente desde `@charlybot/shared`.

## Valkey

`src/infrastructure/valkey/index.ts` inicializa cliente Valkey usando utilidades de `@charlybot/shared`.
Tiene fallback in-memory por si Valkey no conecta.

## Observability / Metrics

### `/metrics` endpoint

```typescript
// En src/index.ts (línea 40)
const { register: apiRegister } = createMetricsRegistry();
app.get("/metrics", async (c) => {
  c.header("Content-Type", apiRegister.contentType);
  return c.body(await apiRegister.metrics());
});
```

- Prometheus scrape target (port + `/metrics`)
- Uses `createMetricsRegistry()` from `@charlybot/shared`
- Registers: `error_counter`, `valkey_circuit_gauge`, `prisma_query_duration_histogram`

### `/api/v1/health` endpoint

Authenticated health check that tests DB and Valkey connectivity:

```typescript
// GET /api/v1/health → { status, database, valkey, uptime, timestamp }
// Returns 503 if either DB or Valkey is down
```

## Variables De Entorno (mínimas)

- `API_KEY` (requerida — falla al importar si no está)
- `PORT` (default 3000)
- `LOG_LEVEL` (default "info")
- `DATABASE_URL` (opcional — default `file:packages/shared/dev.db`)
- `OTEL_ENABLED` (opcional — habilita OpenTelemetry tracing)
- `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, `VALKEY_PREFIX`, `VALKEY_MAX_RETRIES`

## Tests

### Estructura

```
apps/api/
  tests/
    setup.ts         ← API_KEY = "test-key" por defecto
    guilds/
      index.test.ts
    economy/
      balance.test.ts
```

### Regla sobre tests

**NUNCA corras tests sin permiso explícito del usuario.**

Los tests de API:
- Modifican estado de la base de datos (usan Prisma directamente)
- Pueden afectar servicios en ejecución
- Requieren `API_KEY` configurada

Si necesitás correr tests, preguntá primero.


## Auto-Invoke Skills

| Action | Skill |
|--------|-------|
| Crear rutas o middleware Hono | `hono` |
| Crear schemas de validación Zod | `zod` |
| Trabajar con modelos Prisma | `prisma-client-api` |
| Escribir tests en API | `vitest` |
| Escribir TypeScript | `typescript` |

## QA Checklist

- [ ] `zValidator(...)` used on all route inputs (no raw request parsing)
- [ ] `authMiddleware` applied to all `/api/*` routes (except public auth routes)
- [ ] Responses are consistent JSON: `{ status, message, data?, error? }`
- [ ] Errors logged with context via `logger.error()` (not bare `console.error`)
- [ ] No Prisma imports outside route/service files
- [ ] Race-condition-sensitive operations wrapped in `prisma.$transaction(...)`
- [ ] `API_KEY` validation at import (no hardcoded fallback in logic)
- [ ] All route handlers return proper HTTP status codes
- [ ] Schemas imported from `@charlybot/shared/schemas/*` (not re-defined)
