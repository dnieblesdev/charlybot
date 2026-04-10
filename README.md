# Charlybot Monorepo

Monorepo Bun con múltiples apps y packages para el ecosistema Charlybot.

## Estructura

```
charlybot/
├── apps/
│   ├── bot/      # Bot de Discord multifuncional
│   └── api/      # API REST externa
├── packages/
│   └── shared/   # Paquete compartido (Prisma, tipos, utilities)
└── docker/     # Configuración Docker
```

## Prerequisites

- **Runtime:** Bun
- **Container:** Docker + Docker Compose

## Inicio Rápido

### Con Docker Compose

```bash
docker compose -f docker/docker-compose.dev.yml up bot api
```

Esto inicia:
- **valkey** — cache/pubsub/streams (puerto 6379)
- **api** — API REST (puerto 3000)
- **bot** — Bot de Discord

### Desarrollo Local

```bash
# Instalar dependencias
bun install

# Configurar .env
cp .env.example .env
# Editar .env con los valores correspondientes

# Iniciar servicios necesarios (Valkey)
docker run -d -p 6379:6379 valkey/valkey:8.0

# Ejecutar apps individualmente
cd apps/bot && bun run dev
cd apps/api && bun run dev
```

## Variables de Entorno

Copiar `.env.example` y configurar:

| Variable | Descripción |
|---|---|
| `DISCORD_TOKEN` | Token del bot de Discord |
| `CLIENT_ID` | Application ID del bot |
| `VALKEY_HOST` | Host de Valkey (default: localhost) |
| `VALKEY_PORT` | Puerto de Valkey (default: 6379) |

## Valkey Integration

El monorepo usa Valkey (Redis-compatible) para:
- **Cache** — datos frecuentemente accedidos
- **Pub/Sub** — messaging entre servicios
- **Streams** — consumidor de música del bot

Cliente: [ioredis](https://github.com/luin/ioredis)

## Scripts Útiles

```bash
# Desarrollo
bun run dev          # Iniciar todas las apps (si tienen script)
bun install          # Instalar dependencias

# Docker
docker compose -f docker/docker-compose.dev.yml up bot api  # Desarrollo
docker compose -f docker/docker-compose.dev.yml down      # Detener
```