# AGENTS.md — CharlyBot Shared (`packages/shared`)

Context for AI agents working on the shared package. Read this in full before making changes.

## Scope Rule

- Used 2+ workspaces → `packages/shared/` (this package)
- Used only in bot → `apps/bot/src/`
- Used only in api → `apps/api/src/`

## CRITICAL RULES

### ALWAYS

| # | Rule | Why |
|---|------|-----|
| 1 | Import from subpath exports (`@charlybot/shared/schemas/economy`) | Allows tree-shaking and avoids circular dependency issues |
| 2 | Use `createLogger(options?)` from `./observability/logger` | Consistent Winston configuration across bot and API |
| 3 | Use `createMetricsRegistry()` from `./observability/metrics` | Unified Prometheus metrics format |
| 4 | Use AppError subclasses from `./errors` for typed errors | Enables consistent error handling and type-safe catch blocks |

### NEVER

| # | Rule | Consequence |
|---|------|-------------|
| 1 | Edit generated Prisma files in `src/generated/prisma/` | Regenerated on `pnpm run db:generate`, changes are lost |
| 2 | Add runtime dependencies without checking bundle impact | Bot and API share this package; extra deps multiply |
| 3 | Import `prisma` directly in bot commands/services | Bot must use API via HTTP adapters; Prisma is for API layer only |
| 4 | Hardcode Valkey key prefixes | Use constants from `./valkey/redis-keys.ts` |

## TL;DR

- **Purpose**: Shared Prisma client, Zod schemas, observability tools, Valkey utilities.
- **Stack**: TypeScript (ESM), Prisma 7 (PostgreSQL adapter), ioredis (Valkey), prom-client, Winston, Zod 3.
- **Entry**: `src/index.ts` exports all modules.
- **Critical constraint**: Bot does NOT use Prisma directly; it talks to the API over HTTP.

## Subpath Exports

```json
{
  ".": "./src/index.ts",
  "./prisma": "./src/generated/prisma/index.js",
  "./schemas/*": "./src/schemas/*.ts"
}
```

| Export | What you get |
|--------|--------------|
| `@charlybot/shared` | Everything: prisma, all schemas, observability, errors, valkey |
| `@charlybot/shared/prisma` | Generated Prisma client only |
| `@charlybot/shared/schemas/economy` | Economy schema + types |
| `@charlybot/shared/schemas/guild` | Guild config schema |
| `@charlybot/shared/schemas/autorole` | AutoRole schema |
| `@charlybot/shared/schemas/verification` | Verification schema |
| `@charlybot/shared/schemas/music` | Music schema |
| `@charlybot/shared/schemas/classes` | Classes schema |
| `@charlybot/shared/schemas/xp` | XP/level schema |
| `@charlybot/shared/schemas/pagination` | Pagination helpers |
| `@charlybot/shared/valkey` | ValkeyClient, ValkeyFallbackWrapper, config, locks, streams |
| `@charlybot/shared/observability` | createLogger, createMetricsRegistry, initTracing, AlertManager |
| `@charlybot/shared/errors` | AppError hierarchy (6 subclasses) |

## Prisma Configuration

**File**: `packages/shared/src/prisma.ts`

```typescript
import { prisma } from "@charlybot/shared";
// Uses PostgreSQL adapter via pg driver
```

- Adapter: `@prisma/adapter-pg` with `pg`
- Default DB: Set via `DATABASE_URL` env var (e.g. `postgresql://user:pass@localhost:5432/charlybot`)
- Log levels: `['query', 'error', 'warn']` in development, `['error']` in production
- Backward compatibility: Scripts support both PostgreSQL and SQLite modes via `DATABASE_URL` detection

## Schemas

| File | Purpose |
|------|---------|
| `src/schemas/autorole.ts` | AutoRole configuration (roles, emoji, channel) |
| `src/schemas/classes.ts` | Class/subclass hierarchy definitions |
| `src/schemas/economy.ts` | Economy user, wallet, bank, transaction types |
| `src/schemas/guild.ts` | Guild settings (welcome, log channels, verification) |
| `src/schemas/music.ts` | Music queue, current track, playlist types |
| `src/schemas/pagination.ts` | Cursor-based pagination helpers |
| `src/schemas/verification.ts` | Verification panel, pending user types |
| `src/schemas/xp.ts` | XP points, level thresholds, rank tracking |

## Observability Module

### Logger (`src/observability/logger.ts`)

```typescript
import { createLogger } from "@charlybot/shared/observability";

const logger = createLogger({ level: "info" });
logger.info("message", { meta });
logger.error("message", { error: err instanceof Error ? err.message : String(err) });
```

- Backend: Winston
- Default level: `info` (override with `LOG_LEVEL` env var)
- IncludesDiscordWinstonTransport for alert-style output

### Metrics (`src/observability/metrics.ts`)

```typescript
import { createMetricsRegistry } from "@charlybot/shared/observability";

const register = createMetricsRegistry();
// Registers: error_counter, valkey_circuit_gauge, prisma_query_duration_histogram
// Prometheus endpoint at /metrics (via prom-client)
```

### Tracing (`src/observability/tracing.ts`)

```typescript
import { initTracing } from "@charlybot/shared/observability";

initTracing("my-service"); // Requires OTEL_ENABLED=true
```

- OpenTelemetry SDK initialization (opt-in via `OTEL_ENABLED=true`)
- Auto-instruments Prisma queries and HTTP calls

### Alert Manager (`src/observability/alert-manager.ts`)

```typescript
import { AlertManager } from "@charlybot/shared/observability";

const alert = new AlertManager(discordWebhookUrl);
alert.send("Error summary", errorContext);
```

- Sends formatted alerts to Discord webhook
- Used by bot for critical error reporting

## Valkey Utilities

**Files in `src/valkey/`:**

| File | Purpose |
|------|---------|
| `types.ts` | Shared Valkey types (ValkeyConfig, StreamMessage) |
| `config.ts` | `getValkeyConfig()` from env vars with defaults |
| `constants.ts` | Default key prefixes and TTL values |
| `redis-keys.ts` | Key builder functions (avoid hardcoded strings) |
| `ValkeyClient.ts` | Main ioredis client wrapper |
| `ValkeyFallbackWrapper.ts` | In-memory fallback when Valkey is unavailable |
| `locks.ts` | Distributed lock utilities |
| `music-streams.ts` | Music queue stream operations |
| `leaderboard-streams.ts` | XP leaderboard stream operations |

**ValkeyConfig defaults** (from env):
- `VALKEY_HOST`: `localhost`
- `VALKEY_PORT`: `6379`
- `VALKEY_PASSWORD`: `undefined`
- `VALKEY_PREFIX`: `charlybot:`
- `VALKEY_MAX_RETRIES`: `3`

**Important**: Valkey is Redis-compatible (ioredis under the hood). Used for music streams, XP leaderboards, distributed locks, and rate-limiting.

## Error Types

All errors extend `AppError(name, statusCode, code)`:

| Class | statusCode | code | Use when |
|-------|------------|------|----------|
| `AppError` | varies | varies | Base class |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `InsufficientFundsError` | 400 | `INSUFFICIENT_FUNDS` | User can't afford operation |
| `CooldownError` | 429 | `COOLDOWN_ACTIVE` | Action rate-limited (includes `remainingMs`) |
| `ValidationError` | 400 | `VALIDATION_ERROR` | Input validation failed |
| `LockContentionError` | 429 | `LOCK_CONTENTION` | Distributed lock blocked |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | External dependency down |

```typescript
import { NotFoundError } from "@charlybot/shared";

throw new NotFoundError("EconomyUser", userId);
```


## Auto-Invoke Skills

| Action | Skill |
|--------|-------|
| Create/modify Zod schemas | `zod` |
| Work with Prisma schema | `prisma-client-api` |
| Write TypeScript, types, utilities | `typescript` |

## QA Checklist

- [ ] No edits to `src/generated/prisma/` files
- [ ] All imports use subpath exports (no deep imports from `src/schemas/*.ts` directly)
- [ ] No new runtime dependencies added without checking impact on bot/API bundles
- [ ] Bot code does NOT import from `@charlybot/shared/prisma` directly
- [ ] Logger used via `createLogger()`, not `console.log`
- [ ] Valkey keys built via `redis-keys.ts` helpers, not hardcoded strings
- [ ] AppError subclasses used for typed errors in new code
- [ ] QA scripts run with `pnpm exec prisma generate` (not `bunx`)
