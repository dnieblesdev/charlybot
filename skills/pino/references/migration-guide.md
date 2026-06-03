# Pino Migration Guide — Winston → Pino

Step-by-step guide for migrating Winston-based logging to Pino in CharlyBot.

## Migration Steps

### 1. Install Dependencies

```bash
pnpm add pino pino-http pino-pretty pino-roll
pnpm remove winston
```

### 2. Create Shared Logger Factory

```typescript
// packages/shared/src/observability/pino.ts
import pino from "pino";

export function createPinoLogger(service: string, env: string, version: string) {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { service, environment: env, version },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
      censor: "[REDACTED]",
    },
  });
}
```

### 3. Update Imports

Replace all `winston.createLogger` imports with the shared logger factory.

### 4. Swap Argument Order (CRITICAL)

Every log call must be reversed:

**Before (Winston):**
```typescript
logger.info("User logged in", { userId: "123" });
```

**After (Pino):**
```typescript
logger.info({ userId: "123" }, "User logged in");
```

### 5. Remove Exception Handlers

Winston's `exceptionHandlers` and `rejectionHandlers` must be replaced with manual handlers:

```typescript
process.on("uncaughtException", (err: Error, origin: string) => {
  logger.fatal({ err: { message: err.message, stack: err.stack, name: err.name }, origin },
    "Uncaught exception — process will exit");
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error({ reason: reason instanceof Error ? reason.message : String(reason) },
    "Unhandled promise rejection");
});
```

### 6. Replace Transports

Winston's `winston.format.json()` is Pino's default — no formatter needed.
- Dev: use `pino-pretty` transport
- Prod: sync JSON to stdout (no transport)

### 7. Add pino-http Middleware

In Hono entry points:

```typescript
import pinoHttp from "pino-http";
app.use(pinoHttp({ logger }));
```

### 8. Configure pino-roll for Rotation

```typescript
const logger = pino({
  transport: {
    target: "pino-roll",
    options: {
      file: process.env.LOG_DIR ?? "./logs/app.log",
      size: process.env.LOG_MAX_SIZE ?? "10m",
      interval: "1d",
      maxFiles: parseInt(process.env.LOG_MAX_FILES ?? "7", 10),
      compress: true,
      mkdir: true,
    },
  },
});
```

## Common Mistakes

1. **Forgetting argument order** — Pino uses `logger.info(meta, msg)`, not `logger.info(msg, meta)`
2. **Using pino-pretty in production** — only for dev
3. **Missing base fields** — every log needs `service`, `environment`, `version`
4. **Not using redact** — credentials will leak
5. **Missing timestamp override** — Pino defaults to epoch time