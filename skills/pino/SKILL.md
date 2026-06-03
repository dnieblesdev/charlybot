---
name: pino
description: "Trigger: configuring Pino logger, migrating Winston to Pino, child loggers, pino-http, transports, rotation, serializers. Pino best practices for CharlyBot."
license: Apache-2.0
metadata:
  author: charlybot
  version: "1.0"
---

## Activation Contract

Activate when configuring logger instances, adding child loggers, migrating from Winston, or setting up transport pipelines for CharlyBot services.

## Hard Rules

1. `level` from env var, never hardcoded — `process.env.LOG_LEVEL ?? "info"`
2. `base` always includes `service`, `environment`, `version` — set once, inherited by all logs
3. `timestamp` uses `pino.stdTimeFunctions.isoTime` — ISO 8601 with timezone
4. `redact` paths for Authorization, Cookie, password, token, secret — use wildcard `*.field`
5. `pino-http` middleware first in Hono, before routes — adds `req`, `res`, `latency_ms`
6. Child loggers with interaction context in bot, request context in API — attach once, use everywhere
7. `transport` only in dev — never in production (sync writes to stdout are fastest)
8. `pino-roll` for rotation — `size` + `interval` + `maxFiles`; compress rotated files
9. Argument order: meta first, message second — the #1 migration mistake

## Decision Gates

| Scenario | Action |
|----------|--------|
| Dev logging | Use `pino-pretty` transport |
| Prod logging | Sync JSON to stdout; no transport |
| HTTP request logging | `pino-http` middleware in Hono |
| Discord interaction context | Child logger with `interaction_id`, `user_id`, `guild_id` |
| Prisma query logging | Child logger with `component: "prisma"` |
| Log rotation | `pino-roll` with size + interval + maxFiles |
| Migrating from Winston | Swap argument order; meta comes first |
| Sensitive data redaction | Configure `redact.paths` with wildcard patterns |

## Execution Steps

1. **Base config**: Use `createPinoLogger(service, env, version)` from `@charlybot/shared` for shared logging.
2. **Dev setup**: Add `pino-pretty` transport only when `NODE_ENV !== "production"`.
3. **HTTP middleware**: Add `pino-http` as the first middleware in Hono apps.
4. **Child loggers**: Create with contextual fields (`request_id`, `interaction_id`, `component`).
5. **Redaction**: Configure `redact.paths` to cover all credential fields before logging.
6. **Exception handlers**: Set up `process.on("uncaughtException")` and `process.on("unhandledRejection")` manually.
7. **Migration**: When moving from Winston, swap argument order in every log call.

## Output Contract

- Structured JSON logs to stdout with `service`, `environment`, `version`, `level`, `time`, `message`
- Child loggers inherit base fields and add contextual bindings
- pino-http adds `req`, `res`, `latency_ms` to every HTTP request log
- Redacted paths show `[REDACTED]` in output

## Verification Scenarios

Given a new service needs logging
When I activate this skill
Then I create a Pino logger with level from env, base fields, and isoTime timestamp

Given a Discord interaction handler
When I need to trace the interaction
Then I create a child logger with interaction_id, user_id, guild_id

Given an API entry point in Hono
When I need HTTP request logging
Then I add pino-http middleware first, before routes

Given a production environment
When configuring the logger
Then I output sync JSON to stdout with no transport

Given a development environment
When configuring the logger
Then I use pino-pretty transport with colorize and translateTime

Given log rotation requirements
When setting up file-based logging
Then I use pino-roll with size, interval, maxFiles, and compress enabled

Given sensitive fields in request headers
When logging HTTP requests
Then I configure redact.paths to censor authorization, cookie, and credential fields

Given a Winston migration
When swapping logger calls
Then I reverse argument order: meta first, message second

Given custom error objects
When configuring serializers
Then I use pino.stdSerializers.err or a custom serializer without stack traces in prod

Given a hot path with frequent logging
When performance is critical
Then I avoid child loggers and use level checks before expensive object construction

## References

- **Full code examples**: [assets/examples.json](assets/examples.json) — 15 runnable examples organized by capability
- **Winston→Pino mapping**: [references/winston-to-pino-mapping.md](references/winston-to-pino-mapping.md) — complete side-by-side comparison with argument order details
- **Migration guide**: [references/migration-guide.md](references/migration-guide.md) — Step-by-step migration guide from Winston to Pino
- **Pino docs**: https://getpino.io
- **pino-http**: https://github.com/pinojs/pino-http
- **pino-pretty**: https://github.com/pinojs/pino-pretty
- **pino-roll**: https://github.com/pinojs/pino-roll
- **Related**: `observability-logging` skill for canonical log schema (LogEntry, log types, levels, redaction rules)