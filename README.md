# CharlyBot

Monorepo del ecosistema CharlyBot — bot de Discord multifuncional con API REST, landing page y dashboard de administración.

## Estructura

```
charlybot/
├── apps/
│   ├── bot/          ← Bot de Discord (Discord.js v14)
│   ├── api/          ← API REST (Hono + Bun)
│   ├── landing/      ← Sitio público (Angular 21 SSR)
│   └── dashboard/    ← Panel de administración (Angular 21 SPA)
├── packages/
│   └── shared/       ← Prisma, schemas Zod, utilidades Valkey
├── docs/             ← Documentación de producción
├── docker/           ← Dockerfiles y compose files
└── scripts/          ← Scripts de utilidad (DB, registro de comandos)
```

## Apps

| App | Descripción | Stack | Puerto |
|---|---|---|---|
| `apps/bot` | Bot de Discord con música, economía, verificación, logs, auto roles y más | Discord.js v14, Bun | — |
| `apps/api` | API REST que sirve datos al bot y dashboard | Hono, Bun, Prisma | 3000 |
| `apps/landing` | Sitio público con documentación interactiva | Angular 21 SSR, Tailwind 4 | 4200 |
| `apps/dashboard` | Panel de administración web | Angular 21 SPA, Tailwind 4 | 4201 |

## Prerrequisitos

- **Bun** (runtime + package manager)
- **Docker** + Docker Compose (para Valkey y despliegue)

## Inicio Rápido

```bash
# Instalar dependencias
bun install

# Configurar variables de entorno
cp .env.example .env

# Iniciar Valkey (cache/pubsub/streams)
docker run -d -p 6379:6379 valkey/valkey:8.0

# Desarrollo — todas las apps
bun run dev               # API + Bot en paralelo

# Desarrollo individual
bun run dev:api           # http://localhost:3000
bun run dev:bot           # Bot de Discord
cd apps/landing && ng serve   # http://localhost:4200
cd apps/dashboard && ng serve # http://localhost:4201
```

### Con Docker Compose

```bash
# Desarrollo (hot reload)
docker compose -f docker/docker-compose.dev.yml up bot api

# Producción (stack completo con Nginx, Valkey, health checks)
docker compose -f docker/docker-compose.yml up -d
```

## Variables de Entorno Principales

| Variable | App | Descripción |
|---|---|---|
| `DISCORD_TOKEN` | Bot | Token del bot de Discord |
| `CLIENT_ID` | Bot | Application ID |
| `API_KEY` | API + Bot | Clave de auth entre servicios |
| `API_URL` | Bot | URL de la API (default: `http://localhost:3000`) |
| `VALKEY_HOST` | API + Bot | Host de Valkey (default: `localhost`) |
| `VALKEY_PORT` | API + Bot | Puerto de Valkey (default: `6379`) |
| `DATABASE_URL` | API | Ruta de SQLite (default: `file:./dev.db`) |
| `SPOTIFY_CLIENT_ID` | Bot | Credenciales Spotify |

> Ver `docs/production-deploy.md` para la lista completa de variables de producción.

## Valkey

El monorepo usa Valkey (Redis-compatible) para:

- **Cache** — datos frecuentemente accedidos
- **Pub/Sub** — mensajería entre servicios
- **Streams** — colas de música y leaderboard
- **Locks distribuidos** — operaciones de economía
- **Rate limiting** — protección de endpoints
- **Idempotencia** — prevención de interacciones duplicadas de Discord

Tanto la API como el bot tienen fallback en memoria si Valkey no está disponible.

## Scripts Útiles

```bash
# Desarrollo
bun run dev               # API + Bot
bun run dev:api           # Solo API
bun run dev:bot           # Solo Bot

# Bot: administración de slash commands
bun run rc                # Registrar comandos
bun run cc                # Limpiar comandos
bun run lc                # Listar comandos registrados

# Base de datos
bun run db:migrate        # Ejecutar migraciones
bun run db:push           # Push del schema
bun run db:backup         # Backup de SQLite
bun run db:restore        # Restaurar backup

# Docker
docker compose -f docker/docker-compose.dev.yml up bot api
docker compose -f docker/docker-compose.dev.yml down
```

## Documentación

- [`docs/production-deploy.md`](docs/production-deploy.md) — Guía completa de despliegue en producción
- [`apps/bot/AGENTS.md`](apps/bot/AGENTS.md) — Guía para agentes de IA en el bot
- [`apps/api/AGENTS.md`](apps/api/AGENTS.md) — Guía para agentes de IA en la API
