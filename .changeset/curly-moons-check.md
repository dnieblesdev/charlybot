---
"@charlybot/api": minor
---

Add structured JSON logging with request correlation and access logs

- Add `requestId` middleware: reads/propagates `X-Request-ID` header
- Add `accessLog` middleware: emits `type: "http_access"` with method, path, status, latency_ms
- Add `app.onError()` handler: catches unhandled route exceptions as `type: "unhandled_exception"`
- Add global process handlers for `uncaughtException`/`unhandledRejection` (structured fatals)
- Replace inline `logger.error` in route catch blocks with `logRouteError()` helper
- Add structured warnings in 6 empty `music-queue-cache.service.ts` catch blocks
- Demote per-guild OAuth loop from `info` to `debug`
- Remove Winston dependency (now uses Pino from `@charlybot/shared`)
- Logs now output JSON in production, pretty text in development