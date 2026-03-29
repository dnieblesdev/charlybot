# @charlybot/bot

## 2.2.1

### Patch Changes

- perf: optimize economy commands with parallel requests and cleanup

  - Add Promise.all() in /work command for parallel DB calls
  - Add tempStorage.destroy() call on graceful shutdown

## 2.2.0

### Minor Changes

- Fixed race conditions in economy operations:

  - Updated EconomyService to use atomic Prisma transactions
  - Added atomic wrapper functions in EconomyRepo
  - Added transfer(), deposit(), withdraw() methods to HttpEconomyAdapter
  - These changes prevent money loss/duplication during server crashes

## 2.1.9

### Patch Changes

- fix(bot): reduce HTTP latency with in-memory cache

  Implemented generic MemoryCache with 5-minute TTL for GuildConfig,
  EconomyConfig and Leaderboard. Cache hit reduces latency from ~500ms
  to ~2ms. Automatic invalidation on write operations.

## 2.1.8

### Patch Changes

- refactor: MusicService monolith into 4 services + fixes

  \- Split MusicService into VoiceConnectionService, AudioStreamService,

  &nbsp; QueueManagementService, PlayerService

  \- Fix audio playback (StreamType, connection.subscribe, PassThrough)

  \- Fix queue management (isPlaying check, currentSong tracking)

  \- Fix /music skip to return nowPlaying song

  \- Add skip notification with current song title

  \- Add silent auto-play (no spam during playlists)

  \- Use display name instead of username in music embeds

## 2.1.7

### Patch Changes

- Fix infinite loop in music playback when songs end naturally

  When a song finished playing, the system would incorrectly recover the persisted queue and restart playback, causing an infinite loop. Fixed by clearing `queue.currentSong` in the Idle event handler when no loop mode is active.

## 2.1.6

### Patch Changes

- Fix: add python3 to Docker production image (required by yt-dlp)

## 2.1.5

### Patch Changes

- Chore: remove yt-dlp symlink from Dockerfile (now uses which() in PATH)

## 2.1.4

### Patch Changes

- Fix: Use which() to find yt-dlp in PATH first, fallback to local bin

## 2.1.3

### Patch Changes

- Fix: Use symlink for yt-dlp in Docker instead of broken shell wrapper

## 2.1.2

### Patch Changes

- Fix: Add ffmpeg fallback chain for Docker production environment

## 2.1.1

### Patch Changes

- fix(music): add defensive checks for malformed YouTube search results

  - Wrap playdl.search() in try/catch to handle internal parse errors from play-dl 1.9.7
  - Prevents crash when YouTube returns malformed search results
  - Fixes: undefined is not an object (evaluating navigationEndpoint.browseEndpoint.browseId)

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
