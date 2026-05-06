# 📊 CharlyBot Dashboard

Panel de administración web para gestionar la configuración del bot, ver estadísticas y moderar verificaciones.

## 🚀 Desarrollo

```bash
bun install
ng serve                    # http://localhost:4201
bun run dev                 # Si definido en package.json
```

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| Framework | Angular 21 |
| Renderizado | SPA (Client-side) |
| Estilos | Tailwind CSS 4 |
| Testing | Vitest (unitarios), Jest |
| API | Proxy a `apps/api` vía Nginx |

## 📁 Estructura

```
src/
  app/
    features/           ← Componentes por feature (guilds, economy, verifications)
    shared/             ← Componentes, guards, interceptors compartidos
  assets/               ← Imágenes, fuentes
  environments/         ← Configuración por ambiente
public/                 ← Favicon, robots.txt
```

## 🔨 Build

```bash
ng build                    # Producción → dist/
ng build --configuration=production
```

## 🧪 Tests

```bash
ng test                     # Vitest + Jest
ng e2e                      # Playwright
```

## 🐳 Docker

```bash
# Desarrollo
docker compose -f docker/docker-compose.dev.yml up dashboard

# Producción
docker compose -f docker/docker-compose.yml up -d dashboard
```

## 🔧 Proxy API

En desarrollo, las llamadas a `/api/*` se redirigen a `http://localhost:3000` vía `proxy.conf.json`. En producción, Nginx maneja el ruteo.
