# @charlybot/shared

## 2.5.1

### Patch Changes

- Security and performance fixes

  - Add `MAX_QUEUE_SIZE` and `MAX_LEADERBOARD_LIMIT` constants
  - Add Zod validation schemas for roulette and leaderboard endpoints
  - Fix circuit breaker: call `recordSuccess()` after successful Valkey operations

## 2.5.0

### Minor Changes

- Add audit log Valkey key builders for message delete tracking

  - Add `AUDIT_LOG` constant in Valkey keys
  - Add `auditLog()`, `auditLogLastEntryId()`, `auditLogProcessedEntryId()` key methods

## 2.4.0

### Minor Changes

- Add Valkey (Redis-compatible) integration layer

  - Add shared Valkey client wrapper with fallback
  - Add key/channel builders for cache, pub/sub, and streams
  - Add Streams helpers for durable music queue processing

## 2.3.1

### Patch Changes

- Persist message log channel config and export truncate helper

  - Add `messageLogChannelId` to guild config schema
  - Add `messageLogChannelId` column to `GuildConfig` Prisma model
  - Export `truncateForEmbedField` utility

## 2.3.0

### Minor Changes

- Add XP/Level system models to Prisma schema

  - Add UserXP model for tracking user XP per server
  - Add XPConfig model for server XP settings
  - Add LevelRole model for automatic role assignment on level up
  - Update Prisma client to v7.6.0

## 2.2.0

### Minor Changes

- Added automatic database backup system:

  - `bun run db:backup` - Create daily backup
  - `bun run db:migrate` - Migration with automatic pre-backup
  - `bun run db:push` - db push with automatic pre-backup
  - `bun run db:restore` - Restore from backup
  - `bun run db:rotate` - Rotate old backups (keeps 7 daily, 3 migration)

  This prevents complete data loss during failed Prisma migrations.

## 2.1.1

### Patch Changes

- Fix: Use absolute path for SQLite database fallback to avoid multiple dev.db files

## 2.1.0

### Minor Changes

- Agregar Docker para desarrollo local

  - Agregar docker-compose.dev.yml para levantar API y bot en contenedores
  - Agregar Dockerfiles para api y bot con Bun + FFmpeg + yt-dlp
  - Montar dev.db como volumen bidireccional desde host
  - Configurar red interna Docker para comunicación api-bot
  - Agregar .env.docker para variables de entorno Docker
  - Agregar .dockerignore

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
