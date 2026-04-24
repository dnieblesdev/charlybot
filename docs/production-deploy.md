# CharlyBot — Production Deployment Guide

Production deployment reference for CharlyBot monorepo. Covers single-server Docker Compose部署 with all services, Valkey configuration, health checks, scaling, backup, and security.

---

## 1. Overview

CharlyBot is a Discord bot platform with supporting web infrastructure:

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

### Services

| Service | Role | Port | Tech |
|---|---|---|---|
| `valkey` | Cache, pub/sub, streams, rate limiting, locks | 6379 | Valkey 8 |
| `api` | REST API for bot data operations | 3000 | Hono + Bun |
| `bot` | Discord bot (slash commands, events) | — | Discord.js v14 |
| `landing` | Marketing site with SSR | 4200 | Angular 17 SSR |
| `dashboard` | Admin dashboard SPA | 4201 | Angular 17 SPA |
| `proxy` | Nginx reverse proxy | 80 | nginx:alpine |

### Architecture Notes

- **Bot → API via HTTP**: The bot does NOT connect to the database directly. All data operations go through the API (`apps/bot/src/infrastructure/api/*` adapters).
- **API ↔ Valkey**: The API uses Valkey for caching, distributed locks, rate limiting, and music queue streams. Valkey is the shared state layer for horizontally scaling the API.
- **API ↔ SQLite**: The API persists data to SQLite via Prisma + LibSQL adapter.
- **Bot state**: The bot does not share state with the API — it only consumes the API. This means only ONE bot instance can run (Discord gateway limitation). The API can be scaled horizontally because it's stateless.
- **Fallback**: Both bot and API have in-memory fallback if Valkey is unavailable.

---

## 2. Prerequisites

### Software

| Requirement | Minimum | Recommended |
|---|---|---|
| Docker | 24.0 | 25.x |
| Docker Compose | 2.20 | 2.30+ ( Compose V2 ) |
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 10 GB | 20+ GB SSD |

### Domain & SSL

- A domain name pointing to the server's public IP (A record).
- SSL certificates for the domain. Options:
  - **Recommended**: Let's Encrypt via Certbot (`certbot --nginx`)
  - Bring your own wildcard cert and configure Nginx with `ssl_certificate`, `ssl_certificate_key`, and `ssl_protocols TLSv1.2 TLSv1.3`
  - For internal-only deployments, a self-signed cert works but requires browser exceptions.

### Firewall

Open ports:

| Port | Purpose |
|---|---|
| 80 | HTTP (redirect to HTTPS) |
| 443 | HTTPS (Nginx → all services) |
| 22 | SSH (restrict to your IP) |

All internal service-to-service communication stays within the `charlybot-net` Docker network and does not expose ports to the host.

---

## 3. Environment Variables

### Bot (`apps/bot`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal | ` Bot token ` |
| `CLIENT_ID` | ✅ | Application ID (for slash command registration) | `695823543069311116` |
| `GUILD_ID` | | Primary server ID (for command registration scripts) | `346081045055012877` |
| `GUILD_ID2` | | Secondary server ID | `494918316318523392` |
| `GUILD_ID3` | | Tertiary server ID | `1457753108183781398` |
| `OWNER_ID` | | Bot owner Discord ID | `254755729808949249` |
| `API_URL` | ✅ | Internal API URL (Docker service name) | `http://api:3000` |
| `API_KEY` | ✅ | API authentication key | `charly_secret_key` |
| `SPOTIFY_CLIENT_ID` | | Spotify app client ID | — |
| `SPOTIFY_CLIENT_SECRET` | | Spotify app client secret | — |
| `SPOTIFY_REFRESH_TOKEN` | | Spotify refresh token | — |
| `VALKEY_HOST` | | Valkey host (default: `valkey`) | `valkey` |
| `VALKEY_PORT` | | Valkey port (default: `6379`) | `6379` |
| `VALKEY_PASSWORD` | | Valkey auth password | *(strong password)* |
| `VALKEY_PREFIX` | | Key prefix for all Valkey keys (default: `cb`) | `cb` |
| `LOG_LEVEL` | | Log verbosity: `debug\|info\|warn\|error` | `info` |

### API (`apps/api`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `API_KEY` | ✅ | Authentication key (checked at import time — missing = crash) | `charly_secret_key` |
| `PORT` | | HTTP port (default: `3000`) | `3000` |
| `DATABASE_URL` | | SQLite path. Default: `file:/app/packages/shared/dev.db` | `file:/app/packages/shared/dev.db` |
| `VALKEY_HOST` | | Valkey host (default: `valkey`) | `valkey` |
| `VALKEY_PORT` | | Valkey port (default: `6379`) | `6379` |
| `VALKEY_PREFIX` | | Key prefix (default: `cb`) | `cb` |
| `LOG_LEVEL` | | Log verbosity: `debug\|info\|warn\|error` (default: `info`) | `info` |

### Dashboard (`apps/dashboard`)

Dashboard runs as a static SPA served by Nginx. No runtime environment variables are required — all API calls are proxied through Nginx at `/api/v1/*`.

If the dashboard needs to know the API URL at build time, set `NG_APP_API_URL` as a build argument in the Dockerfile.

### Landing (`apps/landing`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | | SSR port (default: `4200`) | `4200` |
| `NGINX_PORT` | | Internal Nginx port (default: `80`) | `80` |
| `SSL_PORT` | | Internal SSL port (default: `443`) | `443` |

### Discord OAuth2 (API + Dashboard)

| Variable | Required | Description | Example |
|---|---|---|---|
| `DISCORD_CLIENT_ID` | ✅ (if using OAuth) | Discord OAuth2 app client ID | — |
| `DISCORD_CLIENT_SECRET` | ✅ (if using OAuth) | Discord OAuth2 app client secret | — |
| `DISCORD_REDIRECT_URI` | ✅ (if using OAuth) | OAuth callback URL | `https://charlybot.example.com/api/v1/auth/callback` |
| `JWT_SECRET` | ✅ (if using auth) | JWT signing secret. Min 32 chars. Generate: `openssl rand -base64 32` | — |

---

## 4. Valkey Production Config

Valkey is used for: caching, pub/sub (music streams), distributed locks (economy operations), rate limiting middleware, and session/cache fallback.

### Memory Sizing

| User Scale | Max Memory | Notes |
|---|---|---|
| < 1,000 users | 256 MB | Sufficient for cache + streams |
| 1,000 – 10,000 | 512 MB | Comfortable headroom |
| 10,000 – 50,000 | 1 GB | Music queues + heavy cache |
| 50,000+ | 2 GB | Monitor `valkey_memory_used_bytes` |

Set via Docker Compose:

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

### Persistence

Enable both **RDB snapshots** and **AOF log** for durability:

```yaml
valkey:
  command:
    - sh
    - -c
    - >-
      valkey-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save 900 1      # RDB: every 15 min if at least 1 key changed
      --save 300 10     # RDB: every 5 min if at least 10 keys changed
      --save 60 10000   # RDB: every 1 min if at least 10000 keys changed
      --appendonly yes
      --appendfsync everysec
      ${VALKEY_PASSWORD:+--requirepass "$VALKEY_PASSWORD"}
```

### Authentication

Set a strong password and pass it via Docker secret (never in plain text):

```bash
# Generate a strong random password
openssl rand -base64 48 | tr -d '/+=' | head -c 32
```

Configure in `docker/.env.valkey`:

```env
VALKEY_PASSWORD=your_strong_random_password_here_min_32_chars
```

Then reference in `docker-compose.yml`:

```yaml
valkey:
  environment:
    - VALKEY_PASSWORD_FILE=/run/secrets/valkey_password
  secrets:
    - valkey_password
```

### TLS (Optional)

Enable TLS only if Valkey port is exposed outside the Docker network (not recommended — Valkey should only be accessible within `charlybot-net`).

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

For most deployments, TLS is unnecessary since all Valkey clients run in the same Docker network.

### Eviction Policy

`allkeys-lru` is recommended for CharlyBot:

- On memory pressure, Valkey evicts the **least recently used keys** across all keyspaces.
- This prevents the cache from consuming all memory and protects the rate limiting and lock keys.
- **Do NOT use** `noeviction` — it will cause Valkey to error on `SET` when memory is full, breaking the entire application.
- Music queue streams (`music:stream:*`) should have explicit TTLs set (see `TTL` constants in `packages/shared/src/valkey/`).

---

## 5. Docker Compose Production

### Full Production `docker-compose.yml`

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

### Environment Files Setup

Create these files from the examples:

```bash
cd docker
cp .env.api.example .env.api        # Fill in API_KEY, DATABASE_URL
cp .env.bot.example .env.bot         # Fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
cp .env.landing.example .env.landing # Fill in PORT, domain
cp .env.dashboard.example .env.dashboard
cp .env.docker.example .env.docker   # Shared vars (Valkey prefix, etc.)
```

For production, add `VALKEY_PASSWORD` to `.env.docker`:

```env
VALKEY_PASSWORD=your_strong_random_password_here_min_32_chars
```

### Starting the Stack

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

### SSL Setup (Nginx)

If using Let's Encrypt, first obtain the certificate, then mount it:

```bash
# After certbot obtains the cert
certbot --nginx -d charlybot.example.com
cp /etc/letsencrypt/live/charlybot.example.com/fullchain.pem docker/nginx/ssl/cert.crt
cp /etc/letsencrypt/live/charlybot.example.com/privkey.pem docker/nginx/ssl/key.pem
```

Or configure Nginx with your own certs in `docker/nginx/nginx.conf`:

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

### API Health Endpoint — `/api/v1/health`

**Auth required.** Returns 200 if all systems operational, 503 if degraded.

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

**Status meanings:**

| `status` | Meaning |
|---|---|
| `ok` | All checks passed (200) |
| `degraded` | One or more checks failed (503) — Valkey fallback active or DB slow |

Public liveness probe at `GET /health` (no auth, no DB check):

```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2025-04-24T12:00:00.000Z"
}
```

### Docker Health Checks

| Service | Check | Interval | Timeout |
|---|---|---|---|
| `valkey` | `valkey-cli ping` | 10s | 3s |
| `api` | HTTP `GET /health` | 10s | 3s |
| `bot` | Process check (`pgrep`) | 30s | 5s |
| `landing` | HTTP `GET /health` | 10s | 3s |
| `dashboard` | HTTP `GET /health` | 30s | 3s |

### Monitoring Integration

#### Prometheus (Optional)

If you want Prometheus metrics, instrument the API with `prom-client`:

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

Then expose a `GET /metrics` endpoint and scrape with Prometheus.

#### Uptime Monitoring

Point your uptime monitor to:

```
https://charlybot.example.com/api/v1/health   # Auth required
# OR
https://charlybot.example.com/health           # Public liveness (no DB check)
```

Use the public `/health` for liveness probes (does DB check internally). Use `/api/v1/health` for readiness — it returns 503 when degraded so your load balancer won't route traffic to a sick instance.

---

## 7. Scaling

### Single Server Deployment

The Docker Compose file above runs all services on one host. This handles:

- Up to ~10,000 concurrent Discord users
- Up to ~1,000 simultaneous music streams
- Normal API traffic

### Multiple API Instances

The API is **stateless** — all shared state is in Valkey. To scale horizontally:

1. Add `deploy.replicas: N` to the API service in `docker-compose.yml`:

```yaml
api:
  deploy:
    replicas: 3
```

2. Valkey is the shared state layer — locks, caches, and rate limiting all work correctly across instances.
3. The bot communicates with the API via `API_URL` — it will hit whichever API instance Docker's DNS resolves. Round-robin load balancing happens automatically.

**Limitation**: SQLite is a file-based database and does NOT support concurrent writes from multiple processes. For multi-instance API deployments, you MUST migrate to PostgreSQL:

```
# 1. Export SQLite data
sqlite3 dev.db ".dump" > dump.sql

# 2. Set PostgreSQL URL in .env.api
DATABASE_URL=postgresql://user:pass@host:5432/charlybot

# 3. Update Prisma schema (packages/shared/prisma/schema.prisma)
#    Change provider from "sqlite" to "postgresql"

# 4. Run migrations
bun run db:migrate

# 5. Import data
psql charlybot < dump.sql
```

The Prisma schema at `packages/shared/prisma/schema.prisma` uses `sqlite` provider. Switching to `postgresql` requires updating the provider and running `bunx prisma db push` or `bun run db:migrate`.

### Bot — Single Instance Only

**The Discord gateway requires exactly ONE bot connection per bot token.** Do NOT run multiple bot instances. The bot is designed as a singleton service.

If you need high availability for the bot, use Discord's **guild subscriptions** to distribute sharding across multiple bot processes (advanced — requires `DISCORD_SHARDING_MODE: auto` and significant architecture changes). This is not covered in this guide.

### Valkey — Single Instance Recommended for Single Server

Valkey in the current setup runs as a single instance. For single-server deployments, this is fine. If you need Valkey HA across multiple servers, consider Valkey Cluster (data sharding) or a managed Redis/Valkey service (Upstash, Redis Cloud).

---

## 8. Backup & Recovery

### SQLite Database Backup

The project includes a backup script at `scripts/db/backup.ts`:

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

**Production backup strategy:**

```bash
# Add to crontab - run daily at 3 AM
0 3 * * * cd /path/to/charlybot && bun run db:backup create daily >> /var/log/charlybot-backup.log 2>&1

# Keep last 30 daily backups (add to backup script logic)
0 3 * * * cd /path/to/charlybot && bun run db:backup create daily && find packages/shared/prisma/backups -name "*_daily_*.db" -mtime +30 -delete
```

### Restore from Backup

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

Or use the restore script:

```bash
bun run db:restore            # Interactive restore
bun run db:restore:latest     # Restore from latest backup
```

### Valkey RDB Snapshots

Valkey persists data to Docker volume `valkey-data`. To backup:

```bash
# Trigger a background save (non-blocking)
docker exec charlybot-valkey-1 valkey-cli SAVE

# Copy the dump file from the container
docker cp charlybot-valkey-1:/data/dump.rdb /backup/valkey-$(date +%Y%m%d).rdb
```

Or mount a host directory for automatic RDB persistence:

```yaml
valkey:
  volumes:
    - valkey-data:/data
    - /host/backup/path:/backups  # For manual snapshot copies
```

### Docker Volume Backup

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

## 9. Security Checklist

### Before Going Live

- [ ] **Change all default passwords**
  - `API_KEY` — generate with `openssl rand -base64 32`
  - `JWT_SECRET` — minimum 32 characters, use `openssl rand -base64 48`
  - `VALKEY_PASSWORD` — strong random, minimum 24 chars
  - `DISCORD_CLIENT_SECRET` — from Discord Developer Portal

- [ ] **Rotate secrets regularly**
  - Schedule quarterly rotation for `API_KEY` and `JWT_SECRET`
  - Bot token rotation requires disabling the old bot in Discord Developer Portal and creating a new one (coordinate downtime)

- [ ] **Verify rate limiting**
  - Test that `/api/*` endpoints respond with `429 Too Many Requests` after exceeding the rate limit
  - Check logs for rate limit hits: `logger.warn("Rate limit exceeded", { ... })`

- [ ] **TLS for all external connections**
  - Redirect HTTP to HTTPS in Nginx
  - All Discord OAuth redirects must use `https://`
  - Spotify redirects must use `https://`

- [ ] **Valkey password**
  - Set `VALKEY_PASSWORD` — never expose Valkey port outside `charlybot-net`
  - If Valkey must be accessed from a different host, enable TLS

- [ ] **API_KEY in transit**
  - All API calls between bot and API happen inside the Docker network — no extra config needed
  - If exposing API outside Docker, add HTTPS

- [ ] **CSP headers (Dashboard)**
  - Angular's built-in CSP is for development. For production, add CSP headers in Nginx:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;" always;
```

- [ ] **Hide error details**
  - Set `LOG_LEVEL=warn` or `LOG_LEVEL=error` in production to prevent stack traces from leaking in responses
  - API returns consistent JSON error shapes — no raw error messages

- [ ] **Discord bot token**
  - Never commit `DISCORD_TOKEN` — use `.env.bot` which is in `.gitignore`
  - Rotate if suspected compromise via Discord Developer Portal

- [ ] **Spotify credentials**
  - `SPOTIFY_CLIENT_SECRET` is sensitive — same rules as bot token

---

## 10. Troubleshooting

### Bot Won't Connect

```
Error: Invalid token
```

- `DISCORD_TOKEN` is wrong or expired. Regenerate at [Discord Developer Portal](https://discord.com/developers/applications).
- Token was regenerated — update `.env.bot` and restart:

```bash
docker compose -f docker/docker-compose.yml restart bot
```

### API Returns 500 on Database Operations

```
Error: Database error: unable to open database file
```

- `DATABASE_URL` path is wrong inside the container. Verify:
  - Dev: `file:./dev.db` (relative to `packages/shared/`)
  - Docker: `file:/app/packages/shared/dev.db`
- Permissions issue — ensure the volume mount is not read-only for the API service.

### Valkey Connection Failures

Valkey failures are **non-fatal** — both the API and bot have in-memory fallback. You'll see warnings in logs:

```
WARN  Failed to connect to Valkey, using fallback only
```

- Check Valkey container is running: `docker compose -f docker/docker-compose.yml ps valkey`
- Check Valkey logs: `docker compose -f docker/docker-compose.yml logs valkey`
- Verify `VALKEY_HOST` matches the service name (`valkey`)
- Test connectivity from API container:

```bash
docker exec charlybot-api-1 sh -c "nc -zv valkey 6379"
```

### Bot Responds with "An error occurred" but API is Fine

- `API_KEY` mismatch between `.env.bot` and `.env.api`. Both must use the same value.
- `API_URL` is wrong — the bot DNS-resolves `api` to the API container IP. Verify `API_URL=http://api:3000`.

### High Memory Usage

- Reduce Valkey `maxmemory` if approaching host RAM limit
- Add memory limits in `deploy.resources.limits.memory` for all services
- Check for memory leaks in bot: `docker stats charlybot-bot-1 --no-stream`
- Spotify stream memory: each active music stream consumes RAM. Set `MAX_QUEUE_SIZE` in the bot to limit concurrent streams.

### Nginx 502 Bad Gateway

One of the backends is not responding. Check:

```bash
# Verify all backends are healthy
docker compose -f docker/docker-compose.yml ps

# Test each backend directly
docker exec charlybot-proxy-1 wget -q -O- http://landing:4200/health
docker exec charlybot-proxy-1 wget -q -O- http://dashboard:4201/health
docker exec charlybot-proxy-1 wget -q -O- http://api:3000/health
```

### Logs

| Service | Command |
|---|---|
| All services | `docker compose -f docker/docker-compose.yml logs -f` |
| Bot only | `docker compose -f docker/docker-compose.yml logs -f bot` |
| API only | `docker compose -f docker/docker-compose.yml logs -f api` |
| Valkey only | `docker compose -f docker/docker-compose.yml logs -f valkey` |
| Nginx | `docker compose -f docker/docker-compose.yml logs -f proxy` |
| Rotate logs | `docker compose -f docker/docker-compose.yml logs --tail=100` |

Inside containers, logs use Winston at `LOG_LEVEL`:

```bash
# Set debug logging temporarily
docker compose -f docker/docker-compose.yml exec api sh
# Then edit env or restart
```

### Debug Mode

Enable verbose logging per service:

```bash
# In .env.api or .env.bot
LOG_LEVEL=debug
```

Then restart:

```bash
docker compose -f docker/docker-compose.yml restart api bot
```

### Common Error Codes

| Code | Meaning |
|---|---|
| `401` | `X-API-Key` header missing or wrong |
| `403` | Bot owner only command (check `OWNER_ID`) |
| `429` | Rate limit hit — wait and retry |
| `500` | Internal error — check API logs |
| `503` | `/api/v1/health` degraded — DB or Valkey issue |

---

## Appendix: Quick Reference

### Ports

| External Port | Service | Internal Endpoint |
|---|---|---|
| 80 | Nginx | HTTP |
| 443 | Nginx | HTTPS |
| 3000 | API | Inside Docker only |
| 4200 | Landing | Inside Docker only |
| 4201 | Dashboard | Inside Docker only |
| 6379 | Valkey | Inside Docker only |

### Key Commands

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

### File Locations

| File | Purpose |
|---|---|
| `docker/docker-compose.yml` | Production orchestrator |
| `docker/docker-compose.dev.yml` | Development with hot reload |
| `docker/nginx/nginx.conf` | Reverse proxy routing |
| `docker/.env.*.example` | Env var templates |
| `packages/shared/prisma/schema.prisma` | Database schema |
| `packages/shared/prisma/backups/` | Backup storage |
| `apps/api/src/index.ts` | API entry point |
| `apps/bot/src/index.ts` | Bot entry point |
| `packages/shared/src/valkey/` | Valkey shared utilities |
