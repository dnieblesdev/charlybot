---
"@charlybot/shared": minor
---

Refactor logging: migrate from Winston to Pino with structured JSON output

- Replace Winston with Pino in `createLogger()` factory
- Add `pino-roll` for file rotation, `pino-pretty` for dev output
- Every log line now includes `service`, `environment`, `version`, and `type` fields
- Child loggers inherit base fields and add `request_id` or `component`
- Remove all Winston dependencies from shared package
- Register global `uncaughtException`/`unhandledRejection` handlers once per process