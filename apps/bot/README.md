# 🤖 CharlyBot

Bot de Discord multifuncional con sistemas de música, economía, verificación, logs, auto roles y más.

## 🚀 Inicio Rápido

```bash
pnpm install
pnpm dev          # Inicia el bot
pnpm rc           # Registra slash commands
pnpm cc           # Limpia slash commands
pnpm lc           # Lista comandos registrados
```

## ✨ Sistemas

### 🎵 Música
Reproducción de YouTube y Spotify con cola, loops, shuffle, control de volumen.

| Comando | Acción |
|---|---|
| `/music play <query>` | Reproduce una canción o playlist |
| `/music skip` | Salta a la siguiente |
| `/music playlist [page]` | Muestra la cola |
| `/music nowplaying` | Canción actual |
| `/music pause` / `resume` | Pausa / reanuda |
| `/music stop` | Detiene y limpia la cola |
| `/music loop <mode>` | none / song / queue |
| `/music shuffle` | Mezcla la cola |
| `/music volume <0-200>` | Ajusta volumen |
| `/music remove <posición>` | Quita canción de la cola |
| `/music clear` | Limpia la cola |
| `/music join` / `leave` | Entra / sale del canal |

### 💰 Economía
Wallet por servidor, banco global, trabajo, crimen, ruleta, robos, leaderboard.

| Comando | Acción |
|---|---|
| `/economia balance` | Ver wallet y banco |
| `/economia deposit` / `retirar` | Mover dinero al banco |
| `/economia work` | Trabajar (cooldown) |
| `/economia crime` | Actividad criminal (riesgo) |
| `/economia rob <@user>` | Robar a otro usuario |
| `/economia ruleta <cantidad>` | Apostar en la ruleta |
| `/economia bail` | Pagar fianza si estás en jail |
| `/economia leaderboard` | Top usuarios del servidor |

### 🔐 Verificación
Panel con botón → modal de registro → revisión de moderador → asignación de rol.

| Comando | Acción |
|---|---|
| `/setup-verification` | Configura el sistema |
| `/send-verification-panel` | Envía el panel interactivo |
| `/list-pending-verifications` | Solicitudes pendientes |

### 🏷️ AutoRole
Asignación de roles por botón o select menu en mensajes configurables.

| Comando | Acción |
|---|---|
| `/autorole setup` | Crear panel de auto roles |
| `/autorole listar` | Ver roles configurados |
| `/autorole editar` | Modificar un rol |
| `/autorole remover` | Eliminar un rol |

### 📊 Clases
Sistema de roles jerárquicos (tipo → clase → subclase).

| Comando | Acción |
|---|---|
| `/addClass` | Agregar clase al sistema |
| `/listClasses` | Listar clases configuradas |
| `/removeClass` | Eliminar clase |

### ⚙️ Configuración
Configuración por servidor (canales de log, bienvenida, verificación).

| Comando | Acción |
|---|---|
| `/set-welcome` | Canal de bienvenida |
| `/set-voice-log-channel` | Canal de logs de voz |
| `/set-message-log` | Canal de logs de mensajes |
| `/set-image-channel` | Canal de imágenes |
| `/show-config` | Ver configuración actual |
| `/config remove` | Eliminar una configuración |
| `/config list` | Listar todas |

### 📝 Logs
Eventos automáticos: entrada/salida de miembros, cambios en canales de voz, mensajes.

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22 |
| Framework | Discord.js v14 |
| Lenguaje | TypeScript (ESM) |
| Audio | `@discordjs/voice`, `play-dl`, `yt-dlp` |
| Cache / PubSub | Valkey (ioredis) |
| Logs | Winston |
| Monitoreo | Prometheus metrics |

## 📁 Estructura

```
src/
  index.ts                      ← Entry point
  app/
    core/                       ← DiscordClient, bootstrap
    commands/                   ← Slash commands (carpeta por comando)
    events/                     ← Event handlers (interactionCreate, voz, logs)
    interactions/               ← customIds, handlers de botones/modales/selects
    services/                   ← Lógica de negocio (MusicService, etc.)
  infrastructure/
    api/                        ← Cliente HTTP + adapters hacia apps/api
    valkey/                     ← Cliente Valkey, idempotencia, rate-limit
    streams/                    ← Consumidores de streams (música, leaderboard)
    monitoring/                 ← Health server, métricas
    cache/                      ← MemoryCache (fallback)
  config/
    repositories/               ← Boundary de acceso a datos
  utils/
    logger.ts                   ← Winston logger
  types/
```

## 🐳 Docker

```bash
# Desarrollo
docker compose -f docker/docker-compose.dev.yml up bot

# Producción
docker compose -f docker/docker-compose.yml up -d bot
```

## 🔧 Variables de Entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token del bot |
| `CLIENT_ID` | ✅ | Application ID |
| `API_URL` | ✅ | URL de la API (default: `http://localhost:3000`) |
| `API_KEY` | ✅ | Clave de autenticación de la API |
| `VALKEY_HOST` | | Host de Valkey (default: `localhost`) |
| `VALKEY_PORT` | | Puerto de Valkey (default: `6379`) |
| `SPOTIFY_CLIENT_ID` | | ID de app Spotify |
| `SPOTIFY_CLIENT_SECRET` | | Secret de app Spotify |
| `SPOTIFY_REFRESH_TOKEN` | | Refresh token Spotify |
| `LOG_LEVEL` | | Nivel de logs (default: `info`) |

## 🧪 Tests

```bash
pnpm test               # Vitest con pool forks
pnpm test:watch     # Watch mode
pnpm test:coverage  # Coverage report (v8)
```
