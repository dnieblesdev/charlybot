# Abstract Helpers (Tool-Agnostic)

Pseudo-code for structured logging helpers. Adapt to your logging library.

## Required Log Helpers

```typescript
// logAccess — HTTP requests or command invocations
logAccess({ method, path, status, latency_ms, request_id })

// logApp — Business logic, feature operations
logApp({ event, operation, error_code, latency_ms, request_id, guild_id })

// logAudit — Administrative or state-changing actions
logAudit({ action, target_user_id, performed_by, guild_id })

// logSecurity — Authentication, authorization, suspicious activity
logSecurity({ event, ip, reason, request_id })
```

## Logger Instantiation

```typescript
function createLogger(config: LogConfig): Logger {
  return Logger.configure({
    level: config.minLevel,
    defaultFields: {
      service: config.service,
      environment: config.env,
      version: config.version,
    },
    formatter: structuredJSON,
    redact: [REDACTED_FIELDS],
  });
}
```

## Sanitization Helper

```typescript
function sanitized(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...metadata };
  for (const key of Object.keys(redacted)) {
    if (KEYWORD_PATTERN.test(key)) {
      redacted[key] = "[REDACTED]";
    }
  }
  return redacted;
}
```

## Request Context

```typescript
async function requestHandler(ctx) {
  const requestId = ctx.request.headers["x-request-id"] || uuid();
  const entry: LogEntry = {
    timestamp: utcNow(),
    level: "info",
    type: "access",
    service: "api",
    environment: process.env.NODE_ENV,
    version: pkg.version,
    request_id: requestId,
    operation: `${ctx.method} ${ctx.path}`,
  };
  log(entry);
  ctx.state.requestId = requestId;
}
```
