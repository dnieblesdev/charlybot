# 🌐 CharlyBot Landing

Sitio público de CharlyBot con SSR. Muestra características, comandos y documentación interactiva del bot.

## 🚀 Desarrollo

```bash
pnpm install
ng serve                    # http://localhost:4200
pnpm dev                 # Si definido en package.json
```

## 🛠️ Stack

| Capa | Tecnología |
|---|---|
| Framework | Angular 21 |
| Renderizado | SSR (Angular Universal) |
| Estilos | Tailwind CSS 4 |
| Testing | Vitest |
| E2E | Playwright |

## 📁 Estructura

```
src/
  app/
    features/           ← Componentes por sección (hero, docs, commands, etc.)
    shared/             ← Componentes compartidos
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
ng test                     # Vitest
ng e2e                      # Playwright
```

## 🐳 Docker

```bash
# Desarrollo
docker compose -f docker/docker-compose.dev.yml up landing

# Producción
docker compose -f docker/docker-compose.yml up -d landing
```

## 🔧 Variables de Entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `4200` | Puerto SSR |
| `NGINX_PORT` | `80` | Puerto interno de Nginx |
| `SSL_PORT` | `443` | Puerto SSL interno |
