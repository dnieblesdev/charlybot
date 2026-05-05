# Release 2026-05-04 - unify-bot-api-monolith

## Packages
- @charlybot/shared: 2.5.3 -> 2.6.0
- @charlybot/api: 2.6.4 -> 2.7.0
- @charlybot/bot: 2.9.2 -> 2.10.0

## @charlybot/shared (minor)
- Add observability module: structured logger, metrics registry (prom-client), alerts, OTel tracing
- Add typed application errors: AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError
- Move Valkey distributed lock utilities from API to shared (withDistributedLock, economyUserLockKey)
- Add async leaderboard stream utilities (producer, consumer, DLQ)
- Increase Valkey commandTimeoutMs default (2s -> 10s) for blocking stream commands
- Fix ValkeyClient fallback for commandTimeoutMs

## @charlybot/api (minor)
- Eliminate HTTP layer between bot and database (unify-bot-api-monolith)
- Add 6 new dashboard API routes with JWT auth (19 endpoints total):
  - economy: leaderboard, config CRUD
  - xp: leaderboard, level-roles, user data
  - music: queue, config CRUD
  - verifications: pending list, approve/reject
  - autoroles: CRUD + mappings
  - classes: CRUD
- Simplify authMiddleware to JWT-only (remove X-API-Key path)
- Add observability: structured logging, metrics, alerts
- Add typed application errors (AppError hierarchy)
- Fix TS strict errors across 19 files
- Clean up 15 old test files for deleted routes
- Fix classes.routes POST FK constraint (test setup)
- Fix verifications.routes PATCH guildAccessMiddleware

## @charlybot/bot (minor)
- Eliminate HTTP adapter layer — bot now uses Prisma directly via @charlybot/shared
- Delete 11 HTTP adapter files (~1,089 lines) from infrastructure/api/
- Rewrite 7 domain repos to direct Prisma: Verification, AutoRole, Classes, GuildConfig, XP, Music, Economy
- Add observability: structured logging, metrics, alerts
- Add typed application errors (AppError hierarchy)
- Add async leaderboard stream consumer with Valkey streams
- Fix LeaderboardStreamConsumer: add loopInFlight re-entrancy guard to prevent XREADGROUP BLOCK pile-up
- Fix auditLogFetcher: move from events/ to utils/ (was causing invalid event warning on startup)
- Fix MusicRepo Valkey import path

## Internal Dependency Updates
- @charlybot/api: @charlybot/shared workspace:* (unchanged)
- @charlybot/bot: @charlybot/shared workspace:* (unchanged)

## Stats
- 35+ files changed
- -5,607 net lines (1,510 added, 7,117 removed)
- 114 tests passing, 0 failures
- 3 commits: 03ceaee, a0ee737, a459942, f23095f
