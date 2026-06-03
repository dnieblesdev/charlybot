# CharlyBot

Aplicación de automatización para Discord. Sistemas integrados de moderación con escalado progresivo, verificación multi-paso, economía transaccional, música multi-fuente y un dashboard de administración web.

---

## El problema

Administrar una comunidad activa en Discord requiere hacer malabares con múltiples bots, cada uno con su propio sistema de comandos, sin un panel centralizado y sin datos compartidos entre funcionalidades.

CharlyBot unifica moderación, verificación, economía, roles automáticos, música y logging en una plataforma modular con dashboard web y sistema de eventos escalable. Un solo bot, una sola interfaz de administración.

---

## Arquitectura

```
                          ┌──────────────────────────┐
                          │       Discord Guild       │
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │     CharlyBot (discord.js)│
                          │  Slash Commands  • Events │
                          │  Anti-spam  •  Music      │
                          └────────────┬─────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
          ┌─────────▼────────┐ ┌──────▼──────┐  ┌───────▼────────┐
          │   Valkey Cache   │ │  REST API   │  │  Prometheus     │
          │ Pub/Sub • Lock   │ │  Hono       │  │  /metrics       │
          │ Rate Limit • DLQ │ │  JWT + OAuth│  └────────────────┘
          └──────────────────┘ └──────┬──────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
          ┌─────────▼────────┐ ┌─────▼──────┐  ┌───────▼────────┐
          │  PostgreSQL (Prisma)│ │  Dashboard │  │   Landing      │
          │ 23 modelos de datos│ │  Angular SPA│  │   Angular SSR  │
          └──────────────────┘ └────────────┘  └────────────────┘
```

El bot procesa interacciones de Discord en tiempo real. Valkey actúa como capa de cache, rate limiting y mensajería Pub/Sub entre servicios. La API REST con JWT + OAuth2 de Discord alimenta al dashboard. Todo corre en contenedores Docker con health checks y nginx como reverse proxy.

---

## Tech Stack

### Bot
- **Runtime** — Node.js 22 (ESM)
- **Framework** — Discord.js v14
- **Audio** — `@discordjs/voice`, play-dl, yt-dlp, libopus
- **Persistencia** — Prisma (PostgreSQL) vía `@charlybot/shared`

### API
- **Runtime** — Node.js 22 (ESM)
- **Framework** — Hono
- **Auth** — JWT (`jose` HS256), Discord OAuth2
- **Validación** — Zod 3

### Frontend
- **Framework** — Angular 21 standalone + zoneless
- **Landing** — SSR con Express 5, pure CSS, glassmorphism
- **Dashboard** — SPA con Tailwind CSS 4, signals

### Infraestructura
- **Cache / Mensajería** — Valkey 8 (Redis-compatible) con fallback in-memory
- **Containerización** — Docker + Docker Compose
- **Proxy** — Nginx
- **Monitoreo** — Prometheus, Winston, OpenTelemetry (opt-in)

---

## Features

### Moderación inteligente
Sistema completo con 9 subcomandos slash y comandos de contexto: warn, timeout, kick, ban, unban, clear (borrado masivo), historial de casos y edición de razones. Escalado automático por thresholds de warns (3 warns → timeout, 5 → kick, 7 → ban). Cada acción genera un ModCase auditado con timestamp, moderador y razón.

### Anti-spam automático
5 reglas de detección: rate limit, menciones masivas, links repetidos, mensajes duplicados y abuso de mayúsculas. Escalado automático en 4 niveles: advertencia → mute 5min → mute 30min → kick. Sin intervención manual.

### Verificación multi-step
Flujo completo: botón "Verificarme" → modal de nombre → select de clase → select de subclase → asignación automática de roles (verified + clase + tipo + subclases) + cambio de nickname. Aprobación/rechazo desde el dashboard.

### Economía con persistencia
Sistema económico con bolsillo y banco. Comandos: work (con cooldown), crime (riesgo de prisión), rob, ruleta (color x2, número x36), leaderboard, bail. Configuración por servidor: cooldowns, montos, tiempos de jail, multiplicadores. Transacciones atómicas con locks distribuidos.

### XP y niveles
Sistema de experiencia con curva exponencial (100 × nivel²). Comandos: rank y leaderboard. Roles automáticos por nivel. Rate limiting anti-grind. Todo configurable por servidor desde el dashboard.

### Música multi-fuente
Reproducción desde YouTube y Spotify. Cola con loop (none/song/queue), shuffle, volumen 0-200%, búsqueda por texto. 4 subsistemas independientes: VoiceConnection, AudioStream, QueueManagement y Player. Persistencia de cola entre desconexiones.

### Auto-roles y sistema de clases RPG
Paneles de auto-rol con botones y/o reacciones. Modos: múltiple (el usuario elige varios roles) o único (solo uno a la vez). Sistema de clases RPG con tipos (Healer/DPS/Tank) y subclases — asigna roles jerárquicos automáticamente.

### Logging integral
Eventos monitoreados: mensajes creados/editados/eliminados, entrada/salida de canales de voz, bienvenida y despedida de miembros. Logs con embeds color-coded y correlación de audit log de Discord (quién borró qué). Deduplicación vía Valkey para evitar ruido.

### Dashboard de administración
10 rutas protegidas con OAuth2 de Discord: overview con métricas, configuración general del servidor, economía (leaderboard + config), XP y level roles, detalle de usuario (XP + economía), cola de música, verificaciones pendientes, auto-roles y sistema de clases. Todo desde el navegador — sin tocar un comando.

### Landing page con documentación interactiva
Sitio público con documentación de 50+ comandos: parámetros, ejemplos y output esperado para cada uno. Sidebar de navegación rápida, selector mobile, botón copiar. Diseño dark con glassmorphism y animaciones.

---

## Screenshots

> _Sección en preparación._ Sugerencias de capturas:

| Captura | Qué mostrar |
|---------|-------------|
| **Dashboard overview** | Panel principal con métricas: top earner, top XP, total users |
| **Flujo de verificación** | Secuencia: botón en Discord → modal → asignación de roles |
| **Panel de moderación** | Dashboard con lista de verificaciones pendientes, botones approve/reject |
| **Configuración de economía** | Formulario del dashboard con cooldowns, montos y multiplicadores |
| **Cola de música** | Dashboard mostrando cola activa, canción actual, volumen y loop |
| **Landing page** | Hero section + grilla de features con glassmorphism |
| **Documentación interactiva** | Sidebar + comando expandido con parámetros y ejemplos |
| **Mobile responsive** | Dashboard abierto desde un teléfono |

---

## Instalación

### Agregar a tu servidor

**[Invitar CharlyBot](https://discord.com/oauth2/authorize?client_id=695823543069311116&permissions=380134359170&scope=bot)**

El bot solicita solo los permisos que realmente necesita (gestionar roles, expulsar, banear, gestionar mensajes y canales) sin requerir el permiso global de Administrator.

### Self-hosting

#### Docker Compose (recomendado)

```bash
git clone https://github.com/dnieblesdev/charlybot.git
cd charlybot
cp .env.example .env

# Desarrollo — copiar envs locales
cp docker/env/dev/.env.api.example docker/env/dev/.env.api
cp docker/env/dev/.env.bot.example docker/env/dev/.env.bot
cp docker/env/dev/.env.landing.example docker/env/dev/.env.landing
cp docker/env/dev/.env.valkey.example docker/env/dev/.env.valkey

# Desarrollo — hot reload usando PostgreSQL local en tu host
docker compose -f docker/docker-compose.dev.yml up

# Desarrollo autocontenido — incluye PostgreSQL en Docker
docker compose -f docker/docker-compose.dev.yml --profile db up
```

Para producción, copiá los envs de `docker/env/prod` y apuntá `DATABASE_URL` a tu PostgreSQL externo/gestionado:

```bash
cp docker/env/prod/.env.api.example docker/env/prod/.env.api
cp docker/env/prod/.env.bot.example docker/env/prod/.env.bot
cp docker/env/prod/.env.landing.example docker/env/prod/.env.landing
cp docker/env/prod/.env.valkey.example docker/env/prod/.env.valkey

# Producción — app stack + Valkey + Nginx. PostgreSQL es externo/gestionado.
docker compose -f docker/docker-compose.yml up -d
```

En desarrollo hay dos modos válidos para PostgreSQL:

- **PostgreSQL local en tu máquina**: es el modo por defecto. Dentro de los contenedores usá `host.docker.internal` en `DATABASE_URL`.
- **PostgreSQL en Docker**: activá el profile `db` y usá el host `postgres` en `DATABASE_URL`.

Producción no levanta PostgreSQL en Docker Compose. Apuntá `DATABASE_URL` a una instancia externa o gestionada.

Los Dockerfiles viven juntos en `docker/dockerfiles/` con nombre explícito por servicio y entorno:

```text
docker/dockerfiles/
├── api.dev.Dockerfile
├── api.prod.Dockerfile
├── bot.dev.Dockerfile
├── bot.prod.Dockerfile
├── landing.dev.Dockerfile
├── landing.prod.Dockerfile
├── dashboard.dev.Dockerfile
└── dashboard.prod.Dockerfile
```

#### Manual

Requiere Node.js 22 y pnpm, y una instancia de Valkey corriendo en `localhost:6379`.

```bash
pnpm install
cp .env.example .env

pnpm dev             # API + Bot
pnpm dev:api         # Solo API (localhost:3000)
pnpm dev:bot         # Solo Bot
```

---

## Variables de entorno

### Bot (Discord)

| Variable | Requerida | Descripción |
|----------|:---------:|-------------|
| `DISCORD_TOKEN` | ✅ | Token del bot |
| `CLIENT_ID` | ✅ | Application ID de Discord |
| `GUILD_ID` | ❌ | Guild para registro rápido de comandos en dev |
| `OWNER_ID` | ❌ | ID del owner para comandos restringidos |

### API y JWT

| Variable | Requerida | Descripción |
|----------|:---------:|-------------|
| `JWT_SECRET` | ✅ | Clave de firma JWT (mínimo 32 caracteres) |
| `DISCORD_CLIENT_ID` | ✅¹ | Client ID para OAuth2 |
| `DISCORD_CLIENT_SECRET` | ✅¹ | Client Secret para OAuth2 |
| `DISCORD_REDIRECT_URI` | ✅¹ | URL de callback OAuth2 |

### Valkey

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VALKEY_HOST` | `localhost` | Host de Valkey |
| `VALKEY_PORT` | `6379` | Puerto |
| `VALKEY_PASSWORD` | — | Contraseña (opcional) |
| `VALKEY_CONNECT_TIMEOUT_MS` | `5000` | Timeout de conexión |
| `VALKEY_COMMAND_TIMEOUT_MS` | `2000` | Timeout de comandos |
| `VALKEY_MAX_RETRIES` | `3` | Reintentos máximos |
| `VALKEY_PREFIX` | `cb` | Prefijo para namespacing de keys |

### Base de datos

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | — | URL de PostgreSQL (ej. `postgresql://user:pass@localhost:5432/charlybot`)

### Spotify

| Variable | Requerida | Descripción |
|----------|:---------:|-------------|
| `SPOTIFY_CLIENT_ID` | ❌² | Client ID de Spotify |
| `SPOTIFY_CLIENT_SECRET` | ❌² | Client Secret de Spotify |
| `SPOTIFY_REFRESH_TOKEN` | ❌² | Refresh token de Spotify |

> ¹ Requeridas solo para el dashboard web (login OAuth2).
> ² Requeridas solo si querés reproducción de música desde Spotify.

### Archivos de entorno por servicio (Docker)

```
docker/
└── env/
    ├── dev/
    │   ├── .env.api.example
    │   ├── .env.bot.example
    │   ├── .env.landing.example
    │   ├── .env.dashboard.example
    │   └── .env.valkey.example
    └── prod/
        ├── .env.api.example
        ├── .env.bot.example
        ├── .env.landing.example
        ├── .env.dashboard.example
        └── .env.valkey.example
```

Copiá al mismo directorio, sin el sufijo `.example`, los archivos que use el compose que vas a levantar. Los `.env` reales son locales y no se versionan. `dashboard` no usa `env_file` actualmente; sus ejemplos quedan como placeholder documentado.

Para `docker/env/dev/.env.api` y `docker/env/dev/.env.bot`:

- PostgreSQL local del host: `DATABASE_URL=postgresql://...@host.docker.internal:5432/charlybot`
- PostgreSQL del profile Docker `db`: `DATABASE_URL=postgresql://...@postgres:5432/charlybot`

Para `docker/env/prod/.env.api` y `docker/env/prod/.env.bot`, `DATABASE_URL` debe apuntar a la base PostgreSQL externa de producción.

---

## Estado del proyecto

En desarrollo activo. El bot está en producción estable en múltiples servidores con +500 guilds.

**Últimos hitos:**
- Sistema de moderación completo (comandos slash, context menus, anti-spam automático)
- API unificada con 19 endpoints para dashboard
- Observabilidad con Prometheus, Winston y OpenTelemetry
- Valkey con fallback in-memory para tolerancia a fallos
- Dashboard funcional con 10 rutas de administración
- Landing page con documentación interactiva de 50+ comandos

---

## Roadmap

### En progreso
- [ ] Panel de configuración de moderación en dashboard
- [ ] Comando `/mod history` con búsqueda avanzada
- [ ] Rate limiting avanzado por canal y rol
- [ ] Cobertura de tests en servicios de música

### Planeado
- [ ] Tickets de soporte (canales temporales)
- [ ] Encuestas con persistencia de votos
- [ ] Recordatorios programados
- [ ] Dashboard: editor visual de auto-roles
- [ ] Dashboard: analytics de actividad del servidor
- [ ] Exportación de logs a CSV/JSON
- [ ] Planes premium con features exclusivas

### Comunidad
- [ ] Servidor de Discord oficial de CharlyBot
- [ ] Sitio web de documentación pública con dominio propio

---

## Licencia

GNU General Public License v3.0 — ver [LICENSE](LICENSE).
