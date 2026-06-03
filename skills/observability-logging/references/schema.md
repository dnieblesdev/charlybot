# Observability Logging Schema

Canonical log schema for CharlyBot. All services MUST emit logs conforming to this schema.

## Log Entry Schema

```typescript
interface LogEntry {
  // REQUIRED FIELDS
  timestamp: string;      // ISO 8601 (e.g. "2026-05-29T10:30:00.000Z")
  level: LogLevel;        // One of: trace, debug, info, warn, error, fatal
  type: LogType;          // One of: access, application, audit, security
  service: Service;       // One of: api, bot, landing, dashboard
  environment: Environment; // One of: local, staging, production
  version: string;       // Semantic version of the service (e.g. "2.6.1")

  // OPTIONAL FIELDS
  request_id?: string;   // UUID v4 — traces a request across services
  user_id?: string;      // Discord user ID or API user identifier
  guild_id?: string;     // Discord guild/server ID
  latency_ms?: number;   // Operation duration in milliseconds
  error_code?: string;   // Machine-readable error identifier
  operation?: string;    // Human-readable operation name
  retryable?: boolean;   // Whether the operation can safely be retried
  error?: SerializedError; // Full error object with name, message, stack, code, cause
  metadata?: Record<string, unknown>; // Additional context (sanitized)
}
```

## Controlled Vocabularies

### `level`

| Value | Semantics |
|-------|----------|
| `trace` | Verbose diagnostic, only in local/staging |
| `debug` | Debug information for development |
| `info` | Normal operational events |
| `warn` | Unexpected but handled situation |
| `error` | Error that caused operation failure |
| `fatal` | Service crash / unresponsive |

### `type`

| Value | When to use |
|-------|------------|
| `access` | HTTP requests, command invocations |
| `application` | Business logic, feature operations |
| `audit` | Administrative actions, state changes |
| `security` | Auth events, permission denials, suspicious activity |

### `service`

| Value | Description |
|-------|-------------|
| `api` | Hono HTTP API (`apps/api`) |
| `bot` | Discord.js bot (`apps/bot`) |
| `landing` | Landing page |
| `dashboard` | Admin dashboard |

### `environment`

| Value | When |
|-------|------|
| `local` | Developer machine |
| `staging` | Staging / preview deployment |
| `production` | Live production environment |

## Field Rules

| Field | Required | Notes |
|-------|----------|-------|
| `timestamp` | **Always** | ISO 8601 with milliseconds. Use UTC. |
| `level` | **Always** | Must be one of the 6 controlled values |
| `type` | **Always** | Must be one of the 4 controlled values |
| `service` | **Always** | Must match emitting service |
| `environment` | **Always** | From deployment environment variable |
| `version` | **Always** | From `package.json` version at build time |
| `request_id` | Recommended | Generate per incoming request; propagate |
| `user_id` | Recommended | Omit for anonymous endpoints |
| `guild_id` | Bot only | Always include for Discord context |
| `latency_ms` | Recommended | For async operations >50ms |
| `error_code` | Recommended | For recoverable errors |
| `operation` | Recommended | String identifier for the operation |
| `retryable` | Optional | Default `undefined` (assume false) |
| `error` | Optional | Serialized error object with name, message, stack, code, cause |
| `metadata` | Optional | Only sanitized, non-sensitive fields |

## metadata Guidelines

The `metadata` object MUST NOT contain:

- Any field matching redaction rules (see `redaction-rules.md`)
- Raw request bodies with credentials
- Stack traces in production

Use flat key names with camelCase or snake_case consistency.

## Serialization Rules

- Timestamps: ISO 8601 string, never Unix epoch
- Error objects: full serialization (name, message, stack, code, cause)
- Null/undefined: omit the field, do not serialize as `null`
- Arrays: only when semantically meaningful (e.g. event names)
