# Winston → Pino Mapping

Reference table for migrating Winston-based logging to Pino in CharlyBot.

## Core Concepts

| Winston | Pino | Notes |
|---------|------|-------|
| `winston.createLogger()` | `pino()` or `pino(options)` | Logger factory |
| `logger.info()` | `logger.info()` | Same method names |
| `logger.debug()` | `logger.debug()` | Same method names |
| `logger.warn()` | `logger.warn()` | Same method names |
| `logger.error()` | `logger.error()` | Same method names |

## Configuration

| Winston | Pino | Notes |
|---------|------|-------|
| `winston.createLogger({ level: 'info' })` | `pino({ level: 'info' })` | Same key |
| `winston.format.json()` | Default (JSON) | Pino logs JSON automatically; no formatter needed |
| `winston.format.timestamp()` | `timestamp: pino.stdTimeFunctions.isoTime` | Pino uses epoch by default; override for ISO 8601 |
| `winston.format.colorize()` | `pino-pretty` (dev only) | Color is for dev; prod should be plain JSON |
| `winston.format.combine()` | N/A | Not needed in Pino |
| `addColors()` | N/A | Color handled by `pino-pretty` |
| `label` | `base.service` | Put service name in base fields |
| `defaultMeta` | `base` | Base fields inherited by every log |

## Argument Order (CRITICAL — most common bug)

| Winston | Pino | Warning |
|---------|------|---------|
| `logger.info('message', meta)` | `logger.info(meta, 'message')` | **Reversed!** Meta FIRST, message SECOND in Pino |

### Correct Usage

**Winston:**
```typescript
logger.info("User logged in", { userId: "123", guildId: "456" });
```

**Pino:**
```typescript
logger.info({ userId: "123", guildId: "456" }, "User logged in");
//                   ^ meta FIRST, message SECOND
```

### Why the reversal?

Pino uses the first argument as the bindings object (like `base` fields), which allows:
- Adding context to all descendant logs via child loggers
- Structured metadata at the log site
- Consistent with Bunyan's API

## Transports

| Winston | Pino | Notes |
|---------|------|-------|
| `transports.Console` | `pino-pretty` (dev) or stdout (prod) | Pretty print only in dev |
| `transports.File` | `pino-roll` or write to file | Rotation needs explicit setup |
| `transports.RotatingFile` | `pino-roll` | Size + interval + maxFiles |
| `maxsize` | `pino-roll` size | e.g., `"10m"` |
| `maxFiles` | `pino-roll` maxFiles | e.g., `7` (keep 7 files) |
| `zippedArchive: true` | `pino-roll` compress: true | Compress rotated logs |

## Exception Handling

| Winston | Pino |
|---------|------|
| `exceptionHandlers: [new transports.File(...)]` | `process.on("uncaughtException", handler)` |
| `rejectionHandlers: [new transports.File(...)]` | `process.on("unhandledRejection", handler)` |

### Winston:
```typescript
const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: "exceptions.log" })],
  exceptionHandlers: [new winston.transports.File({ filename: "exceptions.log" })],
  rejectionHandlers: [new winston.transports.File({ filename: "rejections.log" })],
});
```

### Pino:
```typescript
const logger = pino();

process.on("uncaughtException", (err: Error, origin: string) => {
  logger.fatal({ err: { message: err.message, stack: err.stack, name: err.name }, origin },
    "Uncaught exception — process will exit");
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error(
    { reason: reason instanceof Error ? reason.message : String(reason) },
    "Unhandled promise rejection"
  );
});
```

## Child Loggers

| Winston | Pino |
|---------|------|
| `logger.child({ guildId: '123' })` | `logger.child({ guildId: '123' })` |
| Same pattern | Same API, same concept |

### Winston:
```typescript
const guildLogger = logger.child({ guildId: interaction.guildId });
guildLogger.info("Event processed");
```

### Pino:
```typescript
const guildLogger = logger.child({ guildId: interaction.guildId });
guildLogger.info("Event processed");
```

## Serializers

| Winston | Pino |
|---------|------|
| `serializers: { err: winston.format.error }` | `serializers: { err: pino.stdSerializers.err }` |
| Custom serializer function | Custom serializer function |
| `format.splat()` for %s placeholders | Not needed — Pino uses bindgg |

### Winston:
```typescript
const logger = winston.createLogger({
  serializers: {
    err: winston.format.errors({ stack: true }),
  },
});
```

### Pino:
```typescript
const logger = pino({
  serializers: {
    err: pino.stdSerializers.err,
    // Or custom:
    err: (err: Error) => ({
      message: err.message,
      name: err.name,
      code: (err as any).code,
    }),
  },
});
```

## Levels

| Winston | Pino |
|---------|------|
| `logger.silly()` | `logger.trace()` |
| `logger.debug()` | `logger.debug()` |
| `logger.verbose()` | N/A (Pino has no verbose) |
| `logger.info()` | `logger.info()` |
| `logger.http()` | N/A (no http level in Pino) |
| `logger.warn()` | `logger.warn()` |
| `logger.error()` | `logger.error()` |

## Migration Steps Summary

1. **Swap argument order** in every log call — meta first, message second
2. **Remove** Winston transport config — Pino outputs JSON by default
3. **Set** `timestamp: pino.stdTimeFunctions.isoTime` for ISO 8601 timestamps
4. **Replace** `exceptionHandlers`/`rejectionHandlers` with manual `process.on`
5. **Add** `base: { service, environment, version }` to every logger
6. **Use** `pino-pretty` in dev, stdout in prod
7. **Replace** `winston.format.json()` with Pino's default (already JSON)

## Common Mistakes

1. **Forgetting argument order** — Pino uses `logger.info(meta, msg)` not `logger.info(msg, meta)`
2. **Using `pino-pretty` in production** — dev only
3. **Not setting base fields** — every log needs service, env, version
4. **Using `console.log` instead of logger** — never mix
5. **Missing `timestamp` override** — Pino defaults to epoch time, not ISO 8601

## File Rotation Comparison

### Winston:
```typescript
const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: "app.log",
      maxsize: 10485760,    // 10MB
      maxFiles: 7,
      zippedArchive: true,
    }),
  ],
});
```

### Pino (pino-roll):
```typescript
const logger = pino({
  transport: {
    target: "pino-roll",
    options: {
      file: "./logs/app.log",
      size: "10m",
      interval: "1d",
      maxFiles: 7,
      compress: true,
      mkdir: true,
    },
  },
});
```

## Metadata and Nested Objects

Both loggers support nested metadata, but Pino's approach is more explicit:

### Winston:
```typescript
logger.info("User action", {
  userId: "123",
  guild: {
    id: "456",
    name: "My Server",
  },
});
```

### Pino:
```typescript
logger.info({
  userId: "123",
  guild: {
    id: "456",
    name: "My Server",
  },
}, "User action");
```

The structure is the same; only the argument position differs.