# Redaction Rules

Fields and patterns that MUST NEVER appear in any log output.

## Absolute Prohibitions

The following value types are forbidden in log fields and `metadata` objects:

### Authentication / Authorization

| Forbidden | Replace with |
|-----------|--------------|
| `Authorization` header value | `[REDACTED]` |
| `Authorization: Bearer <token>` | `[REDACTED]` |
| Basic auth credentials | `[REDACTED]` |
| Query string `?token=` values | `[REDACTED]` |

### Tokens / Secrets

| Forbidden | Replace with |
|-----------|--------------|
| JWT tokens (any field) | `[REDACTED]` |
| API keys | `[REDACTED]` |
| OAuth tokens / refresh tokens | `[REDACTED]` |
| Session cookies | `[REDACTED]` |
| Bot tokens | `[REDACTED]` |
| Webhook tokens | `[REDACTED]` |
| Internal service tokens | `[REDACTED]` |

### Credentials

| Forbidden | Replace with |
|-----------|--------------|
| Passwords (any field) | `[REDACTED]` |
| Password confirmations | `[REDACTED]` |
| Hashed passwords | `[REDACTED]` |
| Security answers / recovery codes | `[REDACTED]` |

## Keyword Pattern Matching

Any field whose **key name** contains any of these substrings (case-insensitive) MUST be redacted:

- `password`
- `passwd`
- `pwd`
- `token`
- `apiKey`, `api_key`, `apikey`
- `secret`
- `authorization`
- `authorisation`
- `cookie`
- `jwt`
- `bearer`
- `accessToken`, `access_token`
- `refreshToken`, `refresh_token`
- `sessionId`, `session_id`
- `credential`

Any field whose **value** is a JWT-formatted string (three dot-separated base64url segments) MUST be redacted.

## Redaction Replacement Value

Always use the literal string `[REDACTED]` as the replacement value.

Do NOT use:
- `[REDACTED-32-chars]` (leaks length info)
- `[HIDDEN]` (not standardized)
- `***` (ambiguous)
- Empty string `""` (could be confused with legitimate empty value)

## Exception: System Logs

**In local/staging environments only**, the following are allowed in `debug` or `trace` level logs:

- Field names containing restricted keywords (still redacted values)
- Token prefix/suffix (first 4 + last 4 chars) for debugging only

This exception does NOT apply in production.

## Correct Redaction Examples

```json
// BAD — token in metadata
{
  "metadata": {
    "apiKey": "sk-live-abc123xyz..."
  }
}

// GOOD — redacted
{
  "metadata": {
    "apiKey": "[REDACTED]"
  }
}
```

```json
// BAD — authorization header logged
{
  "metadata": {
    "authHeader": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

// GOOD
{
  "metadata": {
    "authHeader": "[REDACTED]"
  }
}
```

```json
// BAD — cookie value in metadata
{
  "metadata": {
    "sessionCookie": "session_id=abc123; HttpOnly"
  }
}

// GOOD
{
  "metadata": {
    "sessionCookie": "[REDACTED]"
  }
}
```

## Verification

Before emitting any log entry:

1. Scan all field values for JWT patterns (`xxxxx.yyyyy.zzzzz`)
2. Scan all field keys for keyword matches (case-insensitive)
3. Scan metadata object recursively (nested objects and arrays)
4. Confirm no forbidden values remain unreplaced

Tools can automate redaction via a `redact(obj)` function that traverses keys and values.
