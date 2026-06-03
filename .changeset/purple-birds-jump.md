---
"@charlybot/bot": minor
---

Add structured JSON logging for bot commands and fatal paths

- Use shared logger process handlers for unhandled exceptions/rejections
- Replace `logError()` in startup catch with `logger.error({ type: "bot_startup_error" })`
- Logger helpers (`logCommand`, `logVoice`, `logMusic`) now emit type-tagged JSON
- Remove Winston dependency (now uses Pino from `@charlybot/shared`)
- Every log line carries `service: "bot"`, `environment`, and `version` from base fields
