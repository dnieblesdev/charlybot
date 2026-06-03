---
name: observability-logging
description: "Trigger: observability, telemetry, structured logs. Design and emit structured telemetry for CharlyBot using the canonical log schema. Tool-agnostic."
license: Apache-2.0
metadata:
  author: charlybot
  version: "1.0"
  scope: [api, bot, shared]
  auto_invoke:
    - "Adding logging to a feature"
    - "Emitting telemetry"
    - "Structuring a log entry"
    - "Designing observability for a new operation"
    - "Troubleshooting via logs"
---

## Activation Contract

- Adding new logging statements to any service
- Designing telemetry for a new feature or operation
- Reviewing logs for debugging or audit trails
- Creating new operation types or wanting to classify log entries
- Troubleshooting via structured logs

## Decision Gates

| Situation | Do | Don't |
|-----------|----|-------|
| Log HTTP request | Emit `access` with `method`, `path`, `status` at root | Put them in `metadata` |
| Log DB query | Emit `application` with `operation`, `latency_ms` | Use `info` for errors |
| Log auth/token ops | Emit `security` or `debug` level | Use `info` level |
| Propagate context | Use AsyncLocalStorage or child loggers | Pass `request_id` manually through every call |
| Log errors | Serialize full error tree (name, message, stack, code, cause) | Log plain string or missing fields |
| Handle sensitive data | Redact by field key + patterns (JWT, password, token) | Log raw credentials |
| Empty catch block | Always log the caught error | Leave catch block empty |

## Hard Rules

1. **Every log entry MUST have**: `timestamp`, `level`, `type`, `service`, `environment`, `version`
2. **Never log**: passwords, tokens, API keys, JWTs, cookies, Authorization headers
3. **Errors MUST be fully serialized**: capture `name`, `message`, `stack`, `code`, and `cause` recursively. NEVER convert to plain string.
4. **Timestamps MUST be** ISO 8601 UTC strings with milliseconds
5. **level MUST be one of**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
6. **type MUST be one of**: `access`, `application`, `audit`, `security`
7. **service MUST match** the emitting service: `api`, `bot`, `landing`, `dashboard`
8. **environment** MUST come from an environment variable or config, never hardcoded
9. **request_id** MUST be generated per incoming request and propagated via AsyncLocalStorage or child loggers — NEVER pass IDs manually through every function call
10. **metadata is optional** but MUST be sanitized — no credentials, no JWTs, no sensitive fields

## Schema Reference

All log entries conform to:

```typescript
interface LogEntry {
  // REQUIRED — all must be present
  timestamp: string;       // ISO 8601: "2026-05-29T10:30:00.000Z"
  level: LogLevel;
  type: LogType;
  service: Service;
  environment: Environment;
  version: string;        // From package.json at build time
  method?: string;        // HTTP method (access logs only)
  path?: string;          // HTTP path (access logs only)
  status?: number;       // HTTP status code (access logs only)

  // RECOMMENDED
  request_id?: string;    // UUID v4 — trace across services
  user_id?: string;       // Discord user ID or API identifier
  guild_id?: string;      // Discord guild ID (bot only)
  latency_ms?: number;   // Operation duration in ms
  error_code?: string;   // Machine-readable error identifier
  operation?: string;    // Human-readable operation name
  retryable?: boolean;   // Whether retry is safe

  // OPTIONAL
  error?: SerializedError; // Full error tree — never plain string
  metadata?: Record<string, unknown>; // Sanitized only
}
```

See [references/schema.md](references/schema.md) for full vocabulary.

## 4 Log Types

- **access** — HTTP requests or command invocations. One entry per inbound request.
- **application** — Business logic, feature operations, processable events.
- **audit** — Administrative or state-changing actions. Who changed what, when.
- **security** — Authentication, authorization, suspicious activity.

See [assets/good-vs-bad.json](assets/good-vs-bad.json) for full JSON examples of each type.

## 6 Log Levels

| Level | Semantics | When to use |
|-------|-----------|-------------|
| `trace` | Most verbose. Only in local/staging | Deep diagnostic: entering/exiting functions, loop iterations |
| `debug` | Development debugging | State snapshots, variable values; filter out in prod |
| `info` | Normal operations | Command received, API called, role applied |
| `warn` | Unexpected but handled | Retry attempted, rate limit approached, degraded mode |
| `error` | Operation failed | API call failed, command crashed, DB error |
| `fatal` | Service unresponsive | Process crash, DB connection lost, OOM |

See [assets/good-vs-bad.json](assets/good-vs-bad.json) for full JSON examples.

## Context Propagation

Propagate via AsyncLocalStorage or child loggers — NEVER pass IDs manually through every function call.

See [references/context-propagation.md](references/context-propagation.md) for API and Bot patterns.

## Redaction Rules

See [references/redaction-rules.md](references/redaction-rules.md).

**Never log these** (replace all values with `[REDACTED]`):

- Authorization headers
- JWTs, API keys, tokens
- Passwords
- Session cookies
- OAuth secrets
- Any field whose key contains: `password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`, `jwt`

## Error Serialization

Errors MUST be fully serialized to capture the complete error tree:

```typescript
// Correct — capture full error structure recursively
{ "error": serializeError(error) }

function serializeError(err: unknown): SerializedError {
  if (!(err instanceof Error)) return { message: String(err) };
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    code: (err as any).code,
    cause: err.cause ? serializeError(err.cause) : undefined,
  };
}
```

Always include `error_code` for classification.

## Execution Steps

1. Choose correct `type` and `level` using Decision Gates
2. Populate all required fields (`timestamp`, `level`, `type`, `service`, `environment`, `version`)
3. Add contextual fields (`request_id`, `user_id`, `guild_id`, `latency_ms`)
4. Serialize errors fully (name, message, stack, code, cause)
5. Redact sensitive fields before logging
6. Emit structured log entry

See [references/helpers.md](references/helpers.md) for pseudo-code helpers and examples.

## Good vs Bad Examples

See [assets/good-vs-bad.json](assets/good-vs-bad.json) for complete examples of each log type.

## Interactions with Other Skills

- **`pino`** (companion implementation skill): Use for the HOW (Pino API specifics). This skill provides the WHAT (schema, types, levels).
- **`prisma-client-api`**: Database queries should emit `application` logs with `operation`, `latency_ms`, and `error_code` when applicable.
- **`hono`**: HTTP middleware should emit `access` logs at entry and exit.
- **`discord-command`**: Discord interaction handlers should emit `application` logs with `user_id` and `guild_id`.

## Anti-patterns

1. **`console.log` in app code** — always use the structured logger
2. **String concatenation** — interpolate values into log messages
3. **Raw Error objects** — log without serializing name, message, stack, code, cause
4. **Auth tokens/passwords** — log JWTs, API keys, passwords, or Authorization headers
5. **`info` for errors or `debug` for operational events** — use appropriate levels
6. **Mixing log types without `type` field** — always classify with type
7. **Missing `request_id`** — impossible to trace across async boundaries
8. **Emojis in production** — plain text only
9. **Empty catch blocks** — log the caught error
10. **OAuth verbosity** — token operations should be `debug`, not `info`

## Output Contract

| # | Scenario |
|---|----------|
| S1 | GIVEN an HTTP request WHEN it arrives THEN emit `access` log with method, path, status at root |
| S2 | GIVEN a DB query fails WHEN it throws THEN emit `application` error log with serialized error |
| S3 | GIVEN a sensitive action is performed WHEN it changes state THEN emit `audit` log with actor and target |
| S4 | GIVEN a rate limit is triggered WHEN it blocks a request THEN emit `security` log at warn level |
| S5 | GIVEN a request with request_id WHEN it spans 3 async operations THEN all logs share the same request_id |
| S6 | GIVEN a Discord interaction WHEN the bot processes it THEN include interaction.id as request_id |
| S7 | GIVEN a user object with PII WHEN it is logged THEN redact all sensitive fields |
| S8 | GIVEN an Authorization header WHEN it is present THEN redact it completely |
| S9 | GIVEN an error with cause chain WHEN it is serialized THEN capture name, message, stack, code, cause recursively |
| S10 | GIVEN a fatal condition WHEN it occurs THEN log at fatal level to trigger alert |
| S11 | GIVEN a recoverable anomaly WHEN it is handled THEN log at warn level |
| S12 | GIVEN an OAuth token operation WHEN it executes THEN log at debug level |
| S13 | GIVEN an empty catch block WHEN an error is swallowed THEN log the caught error |
| S14 | GIVEN production environment WHEN logging THEN never use emojis |
| S15 | GIVEN a log helper WHEN called THEN enforce all required schema fields |
| S16 | GIVEN a service starts WHEN logger is configured THEN include version from package.json |

## References

- **Schema reference**: [references/schema.md](references/schema.md)
- **Redaction rules**: [references/redaction-rules.md](references/redaction-rules.md)
- **Good/bad examples**: [assets/good-vs-bad.json](assets/good-vs-bad.json)
- **Logger implementation**: `@charlybot/shared/observability` (`createLogger`)
- **Project context**: [AGENTS.md](../../AGENTS.md)
