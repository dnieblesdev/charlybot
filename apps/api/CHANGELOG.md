# @charlybot/api

## 3.1.0

### Minor Changes

- 3c9de0d: Add structured JSON logging with request correlation and access logs

  - Add `requestId` middleware: reads/propagates `X-Request-ID` header
  - Add `accessLog` middleware: emits `type: "http_access"` with method, path, status, latency_ms
  - Add `app.onError()` handler: catches unhandled route exceptions as `type: "unhandled_exception"`
  - Add global process handlers for `uncaughtException`/`unhandledRejection` (structured fatals)
  - Replace inline `logger.error` in route catch blocks with `logRouteError()` helper
  - Add structured warnings in 6 empty `music-queue-cache.service.ts` catch blocks
  - Demote per-guild OAuth loop from `info` to `debug`
  - Remove Winston dependency (now uses Pino from `@charlybot/shared`)
  - Logs now output JSON in production, pretty text in development

### Patch Changes

- Updated dependencies [4b06c9d]
- Updated dependencies [859c660]
  - @charlybot/shared@3.1.0

## 3.0.1

### Patch Changes

- Updated dependencies
  - @charlybot/shared@3.0.1

## 3.0.0

### Major Changes

- Migrate from Bun to pnpm + Node.js 22

  - Replace Bun export default { port, fetch } with @hono/node-server serve()
  - Remove "types": ["bun"] from tsconfig.json
  - Dev script: bun --hot → tsx --watch
  - All require() calls replaced with ESM imports

### Patch Changes

- Updated dependencies
  - @charlybot/shared@3.0.0

## 2.7.0

### Minor Changes

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

### Patch Changes

- Fix TS strict errors across 19 files
- Clean up 15 old test files for deleted routes
- Fix classes.routes POST FK constraint (test setup)
- Fix verifications.routes PATCH guildAccessMiddleware

- Updated dependencies
  - @charlybot/shared@2.6.0

## 2.6.4

### Patch Changes

- Add Valkey behavioral tests S1-S7: cache hit/miss, pub/sub delivery, stream consumer groups, ACK semantics, PEL reclaim, DLQ, idempotent reprocessing (17 tests against real Valkey instance)

- Updated dependencies
  - @charlybot/shared@2.5.3

## 2.6.3

### Patch Changes

- Fix guildAccessMiddleware: extract guildId from URL path instead of Hono params (was matching wildcard routes incorrectly)
- Add Valkey session fallback in guildAccessMiddleware for stale JWT guild lists
- Auto-refresh JWT cookie on GET /api/v1/auth/me with current bot guilds
- Store username in XP increment endpoint (upsert)
- Handle 404 gracefully in dashboard config endpoints (music, economy)

- Updated dependencies
  - @charlybot/shared@2.5.2

## 2.6.2

### Patch Changes

- Fix BigInt precision loss in Discord permission checks (permissions exceed MAX_SAFE_INTEGER)
- Add GET /api/v1/guilds debug endpoint to inspect registered guilds
- Enhance OAuth logging with per-guild permission breakdown (BigInt-based)

## 2.6.1

### Patch Changes

- Add DELETE endpoint for guild cleanup (atomic + idempotent)
- Add guild.owner check in OAuth admin filter
- Add NaN guard for empty permissions string

## 2.6.0

### Minor Changes

- d8581af: Add Discord OAuth2 + JWT authentication

  - Add `/api/v1/auth/login` — redirect to Discord OAuth2
  - Add `/api/v1/auth/callback` — exchange code for JWT tokens
  - Add `/api/v1/auth/me` — user profile + filtered guilds
  - Add `/api/v1/auth/refresh` — refresh access token
  - Add `/api/v1/auth/logout` — invalidate session
  - Add JWT middleware with `jose` library
  - Add Discord OAuth2 service (exchange code, fetch user/guilds)
  - Add Valkey session storage with 7-day TTL

- 4f467a1: Security: HttpOnly cookie auth, guild access middleware, leaderboard pagination
  - Auth callback now sets HttpOnly cookies instead of redirecting with tokens in URL
  - JWT middleware reads from cookie first, falls back to Authorization header
  - Auth middleware dual-mode: JWT cookie OR X-API-Key (backward compat with bot)
  - New `/api/v1/auth/logout` endpoint clears cookies
  - New `guildAccessMiddleware` validates guild access via JWT payload
  - Economy and XP leaderboards now support `?page=&limit=` pagination with `{data, total, page, limit, totalPages}` response
  - JwtPayload extended with `guilds: string[]`

## 2.5.1

### Patch Changes

- Security and performance fixes from adversarial review
  - Add rate limiting middleware (Valkey sliding window + in-memory fallback)
  - Fix timing-safe API key comparison (crypto.timingSafeEqual)
  - Fix mass assignment vulnerability in roulette PATCH endpoints (Zod validation)
  - Fix DoS vector in xp leaderboard (clamp limit to max 100)
  - Split /health into liveness (public) and readiness (auth-protected)
  - Add LRU eviction to Valkey in-memory fallback (prevent OOM)
  - Add pagination to autoroles, classes, verifications pending endpoints
  - Wrap music delete+reorder and classes POST in Prisma transactions
  - Fix cache invalidation for music queue settings mutation
  - Fix double DB fetch in music-queue-cache on cache.set failure
  - Sanitize logging (strip querystring, redact sensitive fields, truncate meta)
  - Force verification status to "pending" on create
  - Reduce Prisma includes in roulette hot paths

## 2.5.0

### Minor Changes

- Docker infrastructure cleanup and API start script
  - Add `start` script to `apps/api/package.json` for decoupled runtime invocation
  - Remove dead entrypoint scripts (`entrypoint.sh`, `docker/docker/entrypoint.sh`)
  - Remove entrypoint overrides from docker-compose.dev.yml
  - Optimize bot Dockerfile: move build deps to builder stage, remove unnecessary API source copies
  - Remove `--frozen-lockfile` from Dockerfiles for lockfile compatibility
  - Clarify dev vs prod strategy with comments

## 2.4.3

### Patch Changes

- Security and performance fixes

  - Fix race condition in music queue: wrap count+create in `prisma.$transaction` with capacity check
  - Add Zod validation via `zValidator` to roulette and leaderboard mutation endpoints
  - Clamp leaderboard `limit` query param to [1, 100]

- Updated dependencies
  - @charlybot/shared@2.5.1

## 2.4.2

### Patch Changes

- Updated dependencies
  - @charlybot/shared@2.5.0

## 2.4.1

### Patch Changes

- docs: add structured API agent guide
  - Add `apps/api/AGENTS.md` describing stack, entrypoint, routes, auth, and conventions.

## 2.4.0

### Minor Changes

- Add Valkey-backed caching and pub/sub hooks
  - Add Valkey provider + cache read-through service for music queue endpoint
  - Add pub/sub subscription wiring (music domain)

### Patch Changes

- Updated dependencies
  - @charlybot/shared@2.4.0

## 2.3.2

### Patch Changes

- Fix guild config persistence for message log channel

  - Persist and return `messageLogChannelId` via `/api/v1/guilds/:id/config`

- Updated dependencies
  - @charlybot/shared@2.3.1

## 2.3.1

### Patch Changes

- Improve AutoRole editing and save flow
  - `/autorole editar` now opens the same interactive editor as setup for already-configured message IDs
  - Fix remover confirmation buttons routing by separating customId namespace
  - Keep setup UI consistent when removing mappings and avoid saving when nothing changed
  - API: add bulk delete endpoint for mappings (`DELETE /autoroles/:id/mappings`)

## 2.3.0

### Minor Changes

- Add XP API routes and improve validation
  - Add /api/v1/xp endpoints for XP management
  - Add strict validation to GuildConfig schema
  - Add subclasses support to ClassConfig creation
  - Make API_KEY environment variable mandatory (no fallback)
  - Add CreateVerificationSchema with configurable status
  - Add test setup improvements for API_KEY and Request URL normalization

### Patch Changes

- Updated dependencies
  - @charlybot/shared@2.3.0

## 2.2.0

### Minor Changes

- Added atomic economy endpoints and test suite:
  - Added `/economy/transfer`, `/economy/deposit`, `/economy/withdraw` endpoints using Prisma transactions
  - Added Vitest test configuration
  - Added integration tests for economy endpoints (34 tests passing)
  - Added schema validation tests (28 tests passing)

### Patch Changes

- Updated dependencies
  - @charlybot/shared@2.2.0

## 2.1.1

### Patch Changes

- Updated dependencies
  - @charlybot/shared@2.1.1

## 2.1.0

### Minor Changes

- Agregar Docker para desarrollo local
  - Agregar docker-compose.dev.yml para levantar API y bot en contenedores
  - Agregar Dockerfiles para api y bot con Bun + FFmpeg + yt-dlp
  - Montar dev.db como volumen bidireccional desde host
  - Configurar red interna Docker para comunicación api-bot
  - Agregar .env.docker para variables de entorno Docker
  - Agregar .dockerignore

### Patch Changes

- Updated dependencies
  - @charlybot/shared@2.1.0

## 2.0.1

### Patch Changes

- 04cc4c0: Fix 404 error when bot starts: add missing PATCH /api/v1/guilds/:id endpoint to handle Guild metadata updates from ready.ts

## 2.0.0

### Major Changes

- fbd0ad3: ## Cambios mayores

  ### Arquitectura Monolito -> Monorepo (API + Bot)

  - **Separación completa**: El proyecto se dividió en dos aplicaciones independientes:
    - `@charlybot/bot`: Bot de Discord (comandos, eventos, servicios)
    - `@charlybot/api`: API REST (endpoints para autorole, clases, economy, guilds, music, verifications)
    - `@charlybot/shared`: Paquete compartido con Prisma, schemas Zod, y utilidades

  ### Hexagonal Architecture en el Bot

  - **Domain Ports**: Interfaces para todos los repositorios (`IAutoRoleRepository`, `IClassRepository`, `IEconomyRepository`, `IGuildConfigRepository`, `IMusicRepository`, `IVerificationRepository`)
  - **Infrastructure Adapters**: Implementaciones HTTP que se comunican con la API del bot
  - **Core**: Lógica de negocio separada de Discord.js

  ### Sistema de Comandos Migrado a Folder Pattern

  - Todos los comandos reorganizados en carpetas con `index.ts` como punto de entrada
  - `config` -> `autorole`, `clases`, `economia`, `music`, `verificacion`
  - Estandarización de `customIds` en `src/app/interactions/customIds.ts`

  ### Prisma

  - Schema actualizado para Prisma 7 (removido `url` del datasource, ahora usa `prisma.config.ts`)
  - Migraciones aplicadas y drift resuelto entre base de datos y archivos de migración
  - Cliente de Prisma regenerado
  - Migraciones de economía y música: Roulette, Leaderboard, EconomyConfig, MusicQueue, GuildMusicConfig

  ### Economía y Juegos

  - Sistema completo de economía por servidor (UserEconomy, GlobalBank)
  - Roulette con bets y resultados
  - Leaderboard con net profit
  - Work, Crime, Rob con cooldowns y jails
  - Sistema de prison por servidor

  ### Sistema de Auto-Roles

  - Modo multiple y unique
  - Soporte para reacciones y botones
  - Embeds personalizables (título, descripción, color, footer, thumbnail, imagen, timestamp, author)

  ### Música

  - Cola persistente (MusicQueue, MusicQueueItem)
  - Loop modes: none, song, queue
  - Volumen, seek, shuffle, remove
  - Configuración por servidor (GuildMusicConfig)

  ### Verificación

  - Solicitudes con screenshots (VerificationRequest)
  - Estados: pending, approved, rejected

  ### API REST

  - Middleware de autenticación con API_KEY
  - Endpoints para todos los módulos:
    - `/autoroles`: CRUD de auto-roles
    - `/classes`: Gestión de clases y subclases
    - `/economy`: Economía, apuestas, leaderboard
    - `/guilds`: Configuración de servidores
    - `/music`: Cola y reproducción
    - `/verifications`: Solicitudes de verificación

  ### Desarrollo

  - Script `dev` ahora ejecuta API y Bot en paralelo usando `concurrently`
  - Solucionado problema donde `bun run dev` esperaba que la API terminara antes de iniciar el bot

  ### Refactors

  - Estandarización de customIds
  - `interactionCreate` dividido en handlers por feature
  - Comandos renombrados: `queue` -> `playlist`
  - Eventos con flags corregidos
  - Soporte para imágenes .avif
  - Flags en eventos de Discord.js

### Patch Changes

- Updated dependencies [fbd0ad3]
  - @charlybot/shared@2.0.0
