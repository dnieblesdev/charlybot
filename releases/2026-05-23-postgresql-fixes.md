# Release 2026-05-23 - PostgreSQL Migration Fixes

## Packages

| Package | Previous | Current | Bump |
|---------|----------|---------|------|
| @charlybot/shared | 3.0.0 | 3.0.1 | patch |
| @charlybot/bot | 3.0.0 | 3.1.0 | minor |
| @charlybot/api | 3.0.0 | 3.0.1 | patch |

## Reasons

### @charlybot/shared@3.0.1
- Fix PrismaPg adapter constructor (Pool instance instead of connection string object)
- Pin all Prisma dependencies to ^7.6.0 for version consistency
- Remove SQLite support from DB scripts (PostgreSQL-only after migration)
- Fix race conditions in backup.ts (pgDump.kill() on error)
- Fix restore.ts pipeline (sequential instead of Promise.race)
- Preserve DATABASE_URL query params (sslmode, schema, etc.) in getPgEnvVars()
- Add credential redaction (redactUrl) to prevent password exposure in logs
- Add dotenv/config to prisma.config.ts for DATABASE_URL loading
- Fix pg_isready healthcheck to use -h localhost for TCP check
- Add PostgreSQL port mapping (5432:5432) to docker-compose.dev.yml
- Fix PRISMA_LOG_QUERIES env var to accept both '1' and 'true'
- Guard TRUNCATE in migrate-data.ts with helpful error message
- Remove dead code (processError, customPath) from backup.ts

### @charlybot/bot@3.1.0
- Configurable anti-spam with per-pattern actions and escalation
- Welcome system: custom variables, show/test subcommands, modal pre-fill
- Social links: /social-link command with URL validation (max 25 links)
- Config display: bullet-list layout, antispam toggle, complete IGuildConfig fields
- Fix TypeScript errors in welcome commands
- Fix deferReply guards and ephemeral bugs
- Updated dependency on @charlybot/shared@3.0.1

### @charlybot/api@3.0.1
- Updated dependency on @charlybot/shared@3.0.1

## Internal Dependency Updates

- @charlybot/bot: @charlybot/shared workspace:* -> workspace:* (no version change, protocol preserved)
- @charlybot/api: @charlybot/shared workspace:* -> workspace:* (no version change, protocol preserved)

## Retroactive Tags

Tags for the 3.0.0 release (bun→pnpm migration, 2026-05-15) were also created:
- @charlybot/shared@3.0.0
- @charlybot/bot@3.0.0
- @charlybot/api@3.0.0
- landing@1.0.0
- dashboard@1.0.0

## Migration Notes

- DATABASE_URL is now required (no SQLite fallback)
- Backup scripts require pg_dump/psql client tools installed
- Docker PostgreSQL exposed on host port 5432
- New env vars documented in .env.example: PRESERVE_ACL, PRISMA_LOG_QUERIES
