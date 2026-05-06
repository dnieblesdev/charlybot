# CharlyBot — Guía de Despliegue en Producción

Referencia de despliegue en producción para el monorepo CharlyBot. Cubre Docker Compose en un solo servidor con todos los servicios, configuración de Valkey, health checks, escalado, backup y seguridad.

---

## 1. Visión General

CharlyBot es una plataforma de bot de Discord con infraestructura web de soporte:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx Reverse Proxy                       │
│  :80 → /           → Landing (Angular SSR)                       │
│       → /dashboard/ → Dashboard (Angular SPA)                   │
│       → /api/*     → API (Hono + Bun)                          │
│       → /api/health → Liveness probe                            │
└─────────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │   Valkey    │    │    API      │    │    Bot      │
     │  (Redis)    │◄───┤  (Hono)     │◄───┤ (Discord)  │
     │  :6379      │    │  :3000      │    │             │
     └─────────────┘    └──────┬──────┘    └─────────────┘
                               │
                          ┌────▼────┐
                          │ SQLite  │
                          │  DB     │
                          └─────────┘
```

### Servicios

| Servicio | Rol | Puerto | Tecnología |
|---|---|---|---|
| `valkey` | Cache, pub/sub, streams, rate limiting, locks | 6379 | Valkey 8 |
| `api` | API REST para operaciones de datos del bot | 3000 | Hono + Bun |
| `bot` | Bot de Discord (slash commands, eventos) | — | Discord.js v14 |
| `landing` | Sitio de marketing con SSR | 4200 | Angular 17 SSR |
| `dashboard` | SPA de administración | 4201 | Angular 17 SPA |
| `proxy` | Proxy reverso Nginx | 80 | nginx:alpine |

### Notas de Arquitectura

- **Bot → API via HTTP**: El bot NO se conecta a la base de datos directamente. Todas las operaciones de datos van a través de la API (`apps/bot/src/infrastructure/api/*` adapters).
- **API ↔ Valkey**: La API usa Valkey para caching, distributed locks, rate limiting, y streams de cola de música. Valkey es la capa de estado compartido para escalar la API horizontalmente.
- **API ↔ SQLite**: La API persiste datos a SQLite via Prisma + LibSQL adapter.
- **Estado del Bot**: El bot no comparte estado con la API — solo consume la API. Esto significa que solo UNA instancia del bot puede ejecutarse (limitación del Discord gateway). La API puede escalar horizontalmente porque es stateless.
- **Fallback**: Tanto el bot como la API tienen fallback en memoria si Valkey no está disponible.

---

## 2. Prerrequisitos

### Software

| Requisito | Mínimo | Recomendado |
|---|---|---|
| Docker | 24.0 | 25.x |
| Docker Compose | 2.20 | 2.30+ ( Compose V2 ) |
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 10 GB | 20+ GB SSD |

### Dominio & SSL

- Un nombre de dominio apuntando a la IP pública del servidor (registro A).
- Certificados SSL para el dominio. Opciones:
  - **Recomendado**: Let's Encrypt via Certbot (`certbot --nginx`)
  - Trae tu propio wildcard cert y configura Nginx con `ssl_certificate`, `ssl_certificate_key`, y `ssl_protocols TLSv1.2 TLSv1.3`
  - Para despliegues internos únicamente, un cert self-signed funciona pero requiere excepciones en el navegador.

### Firewall

Abrir puertos:

| Puerto | Propósito |
|---|---|
| 80 | HTTP (redirección a HTTPS) |
| 443 | HTTPS (Nginx → todos los servicios) |
| 22 | SSH (restringir a tu IP) |

Toda la comunicación interna entre servicios permanece dentro de la red Docker `charlybot-net` y no expone puertos al host.

---

## 3. Variables de Entorno

### Bot (`apps/bot`)

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token del bot desde Discord Developer Portal | ` Bot token ` |
| `CLIENT_ID` | ✅ | Application ID (para registro de slash commands) | `695823543069311116` |
| `GUILD_ID` | | ID del servidor primario (para scripts de registro de comandos) | `346081045055012877` |
| `GUILD_ID2` | | ID del servidor secundario | `494918316318523392` |
| `GUILD_ID3` | | ID del servidor terciario | `1457753108183781398` |
| `OWNER_ID` | | ID de Discord del dueño del bot | `254755729808949249` |
| `API_URL` | ✅ | URL interna de la API (nombre del servicio Docker) | `http://api:3000` |
| `API_KEY` | ✅ | Clave de autenticación de la API | `charly_secret_key` |
| `SPOTIFY_CLIENT_ID` | | Client ID de la app de Spotify | — |
| `SPOTIFY_CLIENT_SECRET` | | Client secret de la app de Spotify | — |
| `SPOTIFY_REFRESH_TOKEN` | | Spotify refresh token | — |
| `VALKEY_HOST` | | Host de Valkey (default: `valkey`) | `valkey` |
| `VALKEY_PORT` | | Puerto de Valkey (default: `6379`) | `6379` |
| `VALKEY_PASSWORD` | | Contraseña de auth de Valkey | *(strong password)* |
| `VALKEY_PREFIX` | | Prefijo de clave para todas las keys de Valkey (default: `cb`) | `cb` |
| `LOG_LEVEL` | | Verbosidad del log: `debug\|info\|warn\|error` | `info` |

### API (`apps/api`)

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `API_KEY` | ✅ | Clave de autenticación (verificada al iniciar — si falta = crash) | `charly_secret_key` |
| `PORT` | | Puerto HTTP (default: `3000`) | `3000` |
| `DATABASE_URL` | | Ruta de SQLite. Default: `file:/app/packages/shared/dev.db` | `file:/app/packages/shared/dev.db` |
| `VALKEY_HOST` | | Host de Valkey (default: `valkey`) | `valkey` |
| `VALKEY_PORT` | | Puerto de Valkey (default: `6379`) | `6379` |
| `VALKEY_PREFIX` | | Prefijo de clave (default: `cb`) | `cb` |
| `LOG_LEVEL` | | Verbosidad del log: `debug\|info\|warn\|error` (default: `info`) | `info` |

### Dashboard (`apps/dashboard`)

El dashboard se ejecuta como SPA estático servida por Nginx. No se requieren variables de entorno en runtime — todas las llamadas a la API se proxean a través de Nginx en `/api/v1/*`.

Si el dashboard necesita saber la URL de la API en build time, configura `NG_APP_API_URL` como build argument en el Dockerfile.

### Landing (`apps/landing`)

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `PORT` | | Puerto SSR (default: `4200`) | `4200` |
| `NGINX_PORT` | | Puerto interno de Nginx (default: `80`) | `80` |
| `SSL_PORT` | | Puerto interno SSL (default: `443`) | `443` |

### Discord OAuth2 (API + Dashboard)

| Variable | Requerida | Descripción | Ejemplo |
|---|---|---|---|
| `DISCORD_CLIENT_ID` | ✅ (si usa OAuth) | Client ID de la app Discord OAuth2 | — |
| `DISCORD_CLIENT_SECRET` | ✅ (si usa OAuth) | Client secret de Discord OAuth2 | — |
| `DISCORD_REDIRECT_URI` | ✅ (si usa OAuth) | URL de callback de OAuth | `https://charlybot.example.com/api/v1/auth/callback` |
| `JWT_SECRET` | ✅ (si usa auth) | Secret para firmar JWT. Mín 32 chars. Generar: `openssl rand -base64 32` | — |

---

## 4. Configuración de Valkey en Producción

Valkey se usa para: caching, pub/sub (streams de música), distributed locks (operaciones de economía), middleware de rate limiting, y fallback de sesión/cache.

### Dimensionamiento de Memoria

| Escala de Usuarios | Memoria Máxima | Notas |
|---|---|---|
| < 1,000 usuarios | 256 MB | Suficiente para cache + streams |
| 1,000 – 10,000 | 512 MB | Margen comfortable |
| 10,000 – 50,000 | 1 GB | Colas de música + cache pesado |
| 50,000+ | 2 GB | Monitorear `valkey_memory_used_bytes` |

Configurar via Docker Compose:

```yaml
valkey:
  command:
    - sh
    - -c
    - >-
      valkey-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      ${VALKEY_PASSWORD:+--requirepass "$VALKEY_PASSWORD"}
```

### Persistencia

Habilitar ambos **RDB snapshots** y **AOF log** para durabilidad:

```yaml
valkey:
  command:
    - sh
    - -c
    - >-
      valkey-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save 900 1      # RDB: cada 15 min si al menos 1 key cambió
      --save 300 10     # RDB: cada 5 min si al menos 10 keys cambiaron
      --save 60 10000   # RDB: cada 1 min si al menos 10000 keys cambiaron
      --appendonly yes
      --appendfsync everysec
      ${VALKEY_PASSWORD:+--requirepass "$VALKEY_PASSWORD"}
```

### Autenticación

Configurar una contraseña fuerte y pasarla via Docker secret (nunca en texto plano):

```bash
# Generar una contraseña aleatoria fuerte
openssl rand -base64 48 | tr -d '/+=' | head -c 32
```

Configurar en `docker/.env.valkey`:

```env
VALKEY_PASSWORD=your_strong_random_password_here_min_32_chars
```

Luego referenciar en `docker-compose.yml`:

```yaml
valkey:
  environment:
    - VALKEY_PASSWORD_FILE=/run/secrets/valkey_password
  secrets:
    - valkey_password
```

### TLS (Opcional)

Habilitar TLS solo si el puerto de Valkey está expuesto fuera de la red Docker (no recomendado — Valkey solo debería ser accesible dentro de `charlybot-net`).

```yaml
valkey:
  command:
    - sh
    - -c
    - >-
      valkey-server
      --tls-port 6380
      --tls-cert-file /certs/valkey.crt
      --tls-key-file /certs/valkey.key
      --tls-ca-cert-file /certs/ca.crt
```

Para la mayoría de los despliegues, TLS es innecesario ya que todos los clientes de Valkey corren en la misma red Docker.

### Política de Evicción

`allkeys-lru` es recomendado para CharlyBot:

- Con presión de memoria, Valkey expulsa las keys **menos usadas recientemente** en todos los keyspaces.
- Esto previene que el cache consuma toda la memoria y protege las keys de rate limiting y locks.
- **NO USAR** `noeviction` — causará que Valkey erro en `SET` cuando la memoria esté llena, rompiendo toda la aplicación.
- Los streams de cola de música (`music:stream:*`) deben tener TTLs explícitos configurados (ver constantes `TTL` en `packages/shared/src/valkey/`).

---

## 5. Docker Compose en Producción

### `docker-compose.yml` Completo de Producción

```yaml
# docker/docker-compose.yml
# Production deployment with health checks, restart policies, and Valkey persistence
# Use: docker compose -f docker/docker-compose.yml up -d

services:
  # ─── Infrastructure ────────────────────────────────────────────────────────

  valkey:
    image: valkey/valkey:8.0
    command:
      - sh
      - -c
      - >-
        valkey-server
        --maxmemory 512mb
        --maxmemory-policy allkeys-lru
        --save 900 1
        --save 300 10
        --save 60 10000
        --appendonly yes
        --appendfsync everysec
        ${VALKEY_PASSWORD:+--requirepass "$VALKEY_PASSWORD"}
    expose:
      - "6379"
    volumes:
      - valkey-data:/data
    networks:
      - charlybot-net
    healthcheck:
      test:
        - CMD-SHELL
        - >-
          valkey-cli ${VALKEY_PASSWORD:+-a "$VALKEY_PASSWORD"} ping
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 768M

  # ─── Application Services ─────────────────────────────────────────────────────

  api:
    build:
      context: ..
      dockerfile: docker/docker/api.Dockerfile
    env_file:
      - ./.env.api
    expose:
      - "3000"
    depends_on:
      valkey:
        condition: service_healthy
    networks:
      - charlybot-net
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
    command: ["bun", "run", "--cwd", "/app/apps/api", "start"]

  bot:
    build:
      context: ..
      dockerfile: docker/docker/bot.Dockerfile
    env_file:
      - ./.env.bot
    depends_on:
      valkey:
        condition: service_healthy
      api:
        condition: service_started
    networks:
      - charlybot-net
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
    command: ["bun", "run", "--cwd", "/app/apps/bot", "src/index.ts"]
    healthcheck:
      test: ["CMD-SHELL", "pgrep -f 'bun.*index.ts' || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  landing:
    build:
      context: ..
      dockerfile: apps/landing/Dockerfile
    env_file:
      - ./.env.landing
    expose:
      - "4200"
    networks:
      - charlybot-net
    healthcheck:
      test:
        - CMD-SHELL
        - "node -e \"fetch('http://127.0.0.1:4200/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))\""
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 20s
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 384M

  dashboard:
    build:
      context: ..
      dockerfile: apps/dashboard/Dockerfile
    expose:
      - "4201"
    networks:
      - charlybot-net
    healthcheck:
      test:
        - CMD-SHELL
        - "wget -q --spider http://127.0.0.1:4201/health || exit 1"
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M

  # ─── Reverse Proxy ────────────────────────────────────────────────────────────

  proxy:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro   # SSL certs (see SSL setup below)
    depends_on:
      landing:
        condition: service_healthy
      dashboard:
        condition: service_healthy
      api:
        condition: service_started
    networks:
      - charlybot-net
    restart: unless-stopped

  # ─── Networks & Volumes ───────────────────────────────────────────────────────

networks:
  charlybot-net:
    driver: bridge

volumes:
  valkey-data:
```

### Configuración de Archivos de Entorno

Crear estos archivos desde los ejemplos:

```bash
cd docker
cp .env.api.example .env.api        # Fill in API_KEY, DATABASE_URL
cp .env.bot.example .env.bot         # Fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
cp .env.landing.example .env.landing # Fill in PORT, domain
cp .env.dashboard.example .env.dashboard
cp .env.docker.example .env.docker   # Shared vars (Valkey prefix, etc.)
```

Para producción, agregar `VALKEY_PASSWORD` a `.env.docker`:

```env
VALKEY_PASSWORD=your_strong_random_password_here_min_32_chars
```

### Iniciando el Stack

```bash
# Pull latest images and start
docker compose -f docker/docker-compose.yml up -d

# View logs
docker compose -f docker/docker-compose.yml logs -f

# Restart a specific service
docker compose -f docker/docker-compose.yml restart bot

# Stop everything
docker compose -f docker/docker-compose.yml down
```

### Configuración de SSL (Nginx)

Si usas Let's Encrypt, primero obten el certificado, luego móntalo:

```bash
# After certbot obtains the cert
certbot --nginx -d charlybot.example.com
cp /etc/letsencrypt/live/charlybot.example.com/fullchain.pem docker/nginx/ssl/cert.crt
cp /etc/letsencrypt/live/charlybot.example.com/privkey.pem docker/nginx/ssl/key.pem
```

O configura Nginx con tus propios certs en `docker/nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name charlybot.example.com;

    ssl_certificate /etc/nginx/ssl/cert.crt;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # ... rest of location blocks
}
```

---

## 6. Health Checks

### Endpoint de Salud de la API — `/api/v1/health`

**Auth requerida.** Retorna 200 si todos los sistemas están operativos, 503 si está degradado.

```json
// GET /api/v1/health
// Headers: X-API-Key: <your-key>
{
  "status": "ok",
  "database": "ok",
  "valkey": "ok",
  "uptime": 12345.67,
  "timestamp": "2025-04-24T12:00:00.000Z"
}
```

**Significados de status:**

| `status` | Significado |
|---|---|
| `ok` | Todos los checks pasaron (200) |
| `degraded` | Uno o más checks fallaron (503) — Fallback de Valkey activo o DB lenta |

Probe de liveness público en `GET /health` (sin auth, sin check de DB):

```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2025-04-24T12:00:00.000Z"
}
```

### Health Checks de Docker

| Servicio | Check | Intervalo | Timeout |
|---|---|---|---|
| `valkey` | `valkey-cli ping` | 10s | 3s |
| `api` | HTTP `GET /health` | 10s | 3s |
| `bot` | Check de proceso (`pgrep`) | 30s | 5s |
| `landing` | HTTP `GET /health` | 10s | 3s |
| `dashboard` | HTTP `GET /health` | 30s | 3s |

### Integración de Monitoreo

#### Prometheus (Opcional)

Si quieres métricas de Prometheus, instrumenta la API con `prom-client`:

```ts
// apps/api/src/metrics.ts
import { register, Counter, Histogram } from 'prom-client';

register.getMetrics();
register.collectDefaultMetrics();

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  labelNames: ['method', 'path', 'status'],
});
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  labelNames: ['method', 'path'],
});
```

Luego expone un endpoint `GET /metrics` y haz scrape con Prometheus.

#### Monitoreo de Uptime

Apunta tu monitor de uptime a:

```
https://charlybot.example.com/api/v1/health   # Auth requerida
# O
https://charlybot.example.com/health           # Liveness público (sin check de DB)
```

Usa `/health` público para liveness probes (hace check de DB internamente). Usa `/api/v1/health` para readiness — retorna 503 cuando está degradado para que tu load balancer no envíe tráfico a una instancia enferma.

---

## 7. Escalado

### Despliegue en Servidor Único

El archivo Docker Compose de arriba ejecuta todos los servicios en un host. Esto maneja:

- Hasta ~10,000 usuarios concurrentes de Discord
- Hasta ~1,000 streams de música simultáneos
- Tráfico normal de API

### Múltiples Instancias de API

La API es **stateless** — todo el estado compartido está en Valkey. Para escalar horizontalmente:

1. Agregar `deploy.replicas: N` al servicio de API en `docker-compose.yml`:

```yaml
api:
  deploy:
    replicas: 3
```

2. Valkey es la capa de estado compartido — locks, caches, y rate limiting funcionan correctamente entre instancias.
3. El bot se comunica con la API via `API_URL` — golpeará la instancia de API que Docker's DNS resuelva. El balanceo de round-robin sucede automáticamente.

**Limitación**: SQLite es una base de datos basada en archivos y NO soporta escrituras concurrentes de múltiples procesos. Para despliegues de API multi-instancia, DEBES migrar a PostgreSQL:

```
# 1. Exportar datos de SQLite
sqlite3 dev.db ".dump" > dump.sql

# 2. Configurar URL de PostgreSQL en .env.api
DATABASE_URL=postgresql://user:pass@host:5432/charlybot

# 3. Actualizar schema de Prisma (packages/shared/prisma/schema.prisma)
#    Cambiar provider de "sqlite" a "postgresql"

# 4. Correr migraciones
bun run db:migrate

# 5. Importar datos
psql charlybot < dump.sql
```

El schema de Prisma en `packages/shared/prisma/schema.prisma` usa provider `sqlite`. Cambiar a `postgresql` requiere actualizar el provider y correr `bunx prisma db push` o `bun run db:migrate`.

### Bot — Solo Una Instancia

**El Discord gateway requiere exactamente UNA conexión de bot por token de bot.** NO ejecutar múltiples instancias del bot. El bot está diseñado como un servicio singleton.

Si necesitas alta disponibilidad para el bot, usa **guild subscriptions** de Discord para distribuir sharding entre múltiples procesos de bot (avanzado — requiere `DISCORD_SHARDING_MODE: auto` y cambios de arquitectura significativos). Esto no está cubierto en esta guía.

### Valkey — Instancia Única Recomendada para Servidor Único

Valkey en la configuración actual corre como instancia única. Para despliegues de servidor único, esto está bien. Si necesitas Valkey HA entre múltiples servidores, considera Valkey Cluster (data sharding) o un servicio manejado de Redis/Valkey (Upstash, Redis Cloud).

---

## 8. Backup y Recuperación

### Backup de Base de Datos SQLite

El proyecto incluye un script de backup en `scripts/db/backup.ts`:

```bash
# Create a daily backup (stored in packages/shared/prisma/backups/)
bun run db:backup create daily

# Create a migration backup (before schema changes)
bun run db:backup create migration

# List all backups
bun run db:backup:list

# Get path to latest backup
bun run db:backup:latest
```

**Estrategia de backup en producción:**

```bash
# Add to crontab - run daily at 3 AM
0 3 * * * cd /path/to/charlybot && bun run db:backup create daily >> /var/log/charlybot-backup.log 2>&1

# Keep last 30 daily backups (add to backup script logic)
0 3 * * * cd /path/to/charlybot && bun run db:backup create daily && find packages/shared/prisma/backups -name "*_daily_*.db" -mtime +30 -delete
```

### Restaurar desde Backup

```bash
# Stop services
docker compose -f docker/docker-compose.yml stop api bot

# Find backup path
bun run db:backup:latest   # prints /path/to/charlybot/packages/shared/prisma/backups/...

# Restore
cp /path/to/latest_backup.db packages/shared/dev.db

# Restart services
docker compose -f docker/docker-compose.yml start api bot
```

O usar el script de restore:

```bash
bun run db:restore            # Interactive restore
bun run db:restore:latest     # Restore from latest backup
```

### Snapshots RDB de Valkey

Valkey persiste datos al volumen Docker `valkey-data`. Para hacer backup:

```bash
# Trigger a background save (non-blocking)
docker exec charlybot-valkey-1 valkey-cli SAVE

# Copy the dump file from the container
docker cp charlybot-valkey-1:/data/dump.rdb /backup/valkey-$(date +%Y%m%d).rdb
```

O montar un directorio del host para persistencia RDB automática:

```yaml
valkey:
  volumes:
    - valkey-data:/data
    - /host/backup/path:/backups  # For manual snapshot copies
```

### Backup de Volumen Docker

```bash
# Backup Valkey volume
docker run --rm \
  -v charlybot_valkey-data:/data:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/valkey-data-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v charlybot_valkey-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/valkey-data-YYYYMMDD.tar.gz -C /data
```

---

## 9. Lista de Verificación de Seguridad

### Antes de Salir a Producción

- [ ] **Cambiar todas las contraseñas por defecto**
  - `API_KEY` — generar con `openssl rand -base64 32`
  - `JWT_SECRET` — mínimo 32 caracteres, usar `openssl rand -base64 48`
  - `VALKEY_PASSWORD` — aleatoria y fuerte, mínimo 24 chars
  - `DISCORD_CLIENT_SECRET` — del Discord Developer Portal

- [ ] **Rotar secrets regularmente**
  - Programar rotación trimestral para `API_KEY` y `JWT_SECRET`
  - La rotación del token del bot requiere deshabilitar el bot viejo en Discord Developer Portal y crear uno nuevo (coordinar downtime)

- [ ] **Verificar rate limiting**
  - Testear que los endpoints `/api/*` respondan con `429 Too Many Requests` después de exceder el rate limit
  - Revisar logs para hits de rate limit: `logger.warn("Rate limit exceeded", { ... })`

- [ ] **TLS para todas las conexiones externas**
  - Redirigir HTTP a HTTPS en Nginx
  - Todos los redirects de Discord OAuth deben usar `https://`
  - Los redirects de Spotify deben usar `https://`

- [ ] **Contraseña de Valkey**
  - Configurar `VALKEY_PASSWORD` — nunca exponer puerto de Valkey fuera de `charlybot-net`
  - Si Valkey debe ser accedido desde un host diferente, habilitar TLS

- [ ] **API_KEY en tránsito**
  - Todas las llamadas a la API entre bot y API suceden dentro de la red Docker — no se necesita config extra
  - Si se expone la API fuera de Docker, agregar HTTPS

- [ ] **Headers CSP (Dashboard)**
  - El CSP built-in de Angular es para desarrollo. Para producción, agregar headers CSP en Nginx:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;" always;
```

- [ ] **Ocultar detalles de errores**
  - Configurar `LOG_LEVEL=warn` o `LOG_LEVEL=error` en producción para prevenir que stack traces se filtren en las respuestas
  - La API retorna errores JSON consistentes — sin mensajes de error crudos

- [ ] **Token del bot de Discord**
  - Nunca commitear `DISCORD_TOKEN` — usar `.env.bot` que está en `.gitignore`
  - Rotar si se sospecha compromiso via Discord Developer Portal

- [ ] **Credenciales de Spotify**
  - `SPOTIFY_CLIENT_SECRET` es sensible — mismas reglas que el token del bot

---

## 10. Solución de Problemas

### El Bot No Se Conecta

```
Error: Invalid token
```

- `DISCORD_TOKEN` está mal o expiró. Regenerar en [Discord Developer Portal](https://discord.com/developers/applications).
- El token fue regenerado — actualizar `.env.bot` y reiniciar:

```bash
docker compose -f docker/docker-compose.yml restart bot
```

### La API Retorna 500 en Operaciones de Base de Datos

```
Error: Database error: unable to open database file
```

- La ruta de `DATABASE_URL` está mal dentro del contenedor. Verificar:
  - Dev: `file:./dev.db` (relativo a `packages/shared/`)
  - Docker: `file:/app/packages/shared/dev.db`
- Problema de permisos — asegurar que el mount del volumen no es read-only para el servicio de API.

### Fallas de Conexión de Valkey

Las fallas de Valkey son **no fatales** — tanto la API como el bot tienen fallback en memoria. Verás warnings en los logs:

```
WARN  Failed to connect to Valkey, using fallback only
```

- Verificar que el contenedor de Valkey está corriendo: `docker compose -f docker/docker-compose.yml ps valkey`
- Verificar logs de Valkey: `docker compose -f docker/docker-compose.yml logs valkey`
- Verificar que `VALKEY_HOST` coincide con el nombre del servicio (`valkey`)
- Testear conectividad desde el contenedor de la API:

```bash
docker exec charlybot-api-1 sh -c "nc -zv valkey 6379"
```

### El Bot Responde con "An error occurred" pero la API Está Bien

- `API_KEY` no coincide entre `.env.bot` y `.env.api`. Ambos deben usar el mismo valor.
- `API_URL` está mal — el bot DNS-resuelve `api` a la IP del contenedor de la API. Verificar `API_URL=http://api:3000`.

### Alto Uso de Memoria

- Reducir `maxmemory` de Valkey si se acerca al límite de RAM del host
- Agregar límites de memoria en `deploy.resources.limits.memory` para todos los servicios
- Buscar memory leaks en el bot: `docker stats charlybot-bot-1 --no-stream`
- Memoria de stream de Spotify: cada stream de música activo consume RAM. Configurar `MAX_QUEUE_SIZE` en el bot para limitar streams concurrentes.

### Nginx 502 Bad Gateway

Uno de los backends no está respondiendo. Verificar:

```bash
# Verify all backends are healthy
docker compose -f docker/docker-compose.yml ps

# Test each backend directly
docker exec charlybot-proxy-1 wget -q -O- http://landing:4200/health
docker exec charlybot-proxy-1 wget -q -O- http://dashboard:4201/health
docker exec charlybot-proxy-1 wget -q -O- http://api:3000/health
```

### Logs

| Servicio | Comando |
|---|---|
| Todos los servicios | `docker compose -f docker/docker-compose.yml logs -f` |
| Solo Bot | `docker compose -f docker/docker-compose.yml logs -f bot` |
| Solo API | `docker compose -f docker/docker-compose.yml logs -f api` |
| Solo Valkey | `docker compose -f docker/docker-compose.yml logs -f valkey` |
| Nginx | `docker compose -f docker/docker-compose.yml logs -f proxy` |
| Rotar logs | `docker compose -f docker/docker-compose.yml logs --tail=100` |

Dentro de los contenedores, los logs usan Winston con `LOG_LEVEL`:

```bash
# Set debug logging temporarily
docker compose -f docker/docker-compose.yml exec api sh
# Then edit env or restart
```

### Modo Debug

Habilitar logging verboso por servicio:

```bash
# In .env.api or .env.bot
LOG_LEVEL=debug
```

Luego reiniciar:

```bash
docker compose -f docker/docker-compose.yml restart api bot
```

### Códigos de Error Comunes

| Código | Significado |
|---|---|
| `401` | Header `X-API-Key` faltante o incorrecto |
| `403` | Comando solo para dueño del bot (verificar `OWNER_ID`) |
| `429` | Rate limit excedido — esperar y reintentar |
| `500` | Error interno — revisar logs de la API |
| `503` | `/api/v1/health` degradado — problema de DB o Valkey |

---

## Appendix: Referencia Rápida

### Puertos

| Puerto Externo | Servicio | Endpoint Interno |
|---|---|---|
| 80 | Nginx | HTTP |
| 443 | Nginx | HTTPS |
| 3000 | API | Solo dentro de Docker |
| 4200 | Landing | Solo dentro de Docker |
| 4201 | Dashboard | Solo dentro de Docker |
| 6379 | Valkey | Solo dentro de Docker |

### Comandos Clave

```bash
# Start
docker compose -f docker/docker-compose.yml up -d

# Stop
docker compose -f docker/docker-compose.yml down

# Restart a service
docker compose -f docker/docker-compose.yml restart bot

# View status
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs -f bot

# DB backup
bun run db:backup create daily

# DB restore
bun run db:restore latest

# Update bot slash commands (run from host, not inside container)
bun run rc
```

### Ubicación de Archivos

| Archivo | Propósito |
|---|---|
| `docker/docker-compose.yml` | Orquestador de producción |
| `docker/docker-compose.dev.yml` | Desarrollo con hot reload |
| `docker/nginx/nginx.conf` | Routing del proxy reverso |
| `docker/.env.*.example` | Templates de vars de entorno |
| `packages/shared/prisma/schema.prisma` | Schema de la base de datos |
| `packages/shared/prisma/backups/` | Almacenamiento de backups |
| `apps/api/src/index.ts` | Entry point de la API |
| `apps/bot/src/index.ts` | Entry point del Bot |
| `packages/shared/src/valkey/` | Utilidades compartidas de Valkey |

(End of file - total 941 lines)
