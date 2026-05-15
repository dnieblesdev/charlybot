# AGENTS.md — Charly API (`apps/api`)

Context for AI agents working on the API. Read this in full before making changes.

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

- Runtime: **Node.js 22** (`tsx --watch`).
- Framework: **Hono**.
- Validation: **zod** + `@hono/zod-validator`.
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

## Commands

```bash
# from apps/api
tsx --watch src/index.ts     # Dev server with hot reload
tsx src/index.ts             # Start server

# from root
pnpm dev:api                 # API dev server
```

## Entry Point

`src/index.ts`:

- `new Hono()`.
- Global logging middleware (`app.use("*", ...)`).
- `GET /health` public (includes simple DB check with `prisma.$queryRaw`).
- `GET /metrics` public (Prometheus scrape endpoint).
- Protects `/api/*` with `authMiddleware`.
- Mounts routers under `/api/v1/...`.
- `GET /api/v1/health` authenticated with DB + Valkey checks.
- Exports `default { port, fetch }` (Bun server).

## Structure

```
src/
  index.ts                   ← Hono app + middleware + routes
  routes/
    guilds.ts
    economy.ts
    economy.routes.ts        ← alternative/split
    xp.ts
    autoroles.ts
    verifications.ts
    classes.ts
    music.ts
    auth.ts                  ← public (no auth middleware)
  middleware/
    authMiddleware.ts        ← validates X-API-Key
    rateLimitMiddleware.ts
  infrastructure/
    valkey/
      index.ts               ← Valkey client + fallback
  services/
    music-queue-cache.service.ts
  utils/
    logger.ts                ← Winston
tests/
  setup.ts                   ← API_KEY set by default
  (tests per feature)
```

## Auth

`src/middleware/authMiddleware.ts`:

- Reads `process.env.API_KEY` at import time and **throws** if not set.
- Validates the `X-API-Key` header.

Implication: in tests/scripts, set `API_KEY` before importing `src/index.ts`.
Tests already have `tests/setup.ts` with a default.

## DB (Prisma)

- Import: `import { prisma } from "@charlybot/shared"`.
- Config: `packages/shared/src/prisma.ts`.
- Default: `packages/shared/dev.db` if `DATABASE_URL` is not set.

**Important**: Both the API and the bot use Prisma directly from `@charlybot/shared`.

## Valkey

`src/infrastructure/valkey/index.ts` initializes the Valkey client using utilities from `@charlybot/shared`.
It has an in-memory fallback in case Valkey doesn't connect.

## Observability / Metrics

### `/metrics` endpoint

```typescript
// In src/index.ts (line 40)
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

## Environment Variables (minimum)

- `API_KEY` (required — fails at import if not set)
- `PORT` (default 3000)
- `LOG_LEVEL` (default "info")
- `DATABASE_URL` (optional — default `file:packages/shared/dev.db`)
- `OTEL_ENABLED` (optional — enables OpenTelemetry tracing)
- `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, `VALKEY_PREFIX`, `VALKEY_MAX_RETRIES`

## Tests

### Structure

```
apps/api/
  tests/
    setup.ts         ← API_KEY = "test-key" by default
    guilds/
      index.test.ts
    economy/
      balance.test.ts
```

### Test Rule

**NEVER run tests without explicit user permission.**

API tests:
- Modify database state (they use Prisma directly)
- May affect running services
- Require `API_KEY` configured

If you need to run tests, ask first.


## Auto-Invoke Skills

| Action | Skill |
|--------|-------|
| Create Hono routes or middleware | `hono` |
| Create Zod validation schemas | `zod` |
| Work with Prisma models | `prisma-client-api` |
| Write tests in API | `vitest` |
| Write TypeScript | `typescript` |

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
