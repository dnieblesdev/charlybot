# AGENTS.md — CharlyBot (monorepo)

Contexto para agentes de IA trabajando en este monorepo. Leelo completo antes de generar cambios.

## TL;DR

- Monorepo con **Bun + TypeScript (ESM)**.
- Apps:
  - `apps/bot`: bot de Discord (Discord.js v14). Entry: `apps/bot/src/index.ts`.
  - `apps/api`: API HTTP (Hono). Entry: `apps/api/src/index.ts`.
- Paquete compartido:
  - `packages/shared`: Prisma client + schemas Zod + utilidades (incluye Valkey).

## Estructura

```
apps/
  api/
  bot/
packages/
  shared/
scripts/
  db/
  registerCommands.ts
  clearCommands.ts
  listRegistered.ts
docker/
  docker-compose.dev.yml
```

## Comandos Rápidos (sin builds/tests)

Desde la raíz:

```bash
bun install

# Dev (corre API + Bot en paralelo)
bun run dev

# Dev individual
bun run dev:api
bun run dev:bot

# Bot: administración de slash commands (scripts/)
bun run rc
bun run cc
bun run lc

# DB (wrappers con backups)
bun run db:backup
bun run db:migrate
bun run db:push
bun run db:restore
```

## Reglas Globales Para Agentes

### Do

- Verificá stack/entrypoints leyendo `package.json` y el entrypoint de cada app.
- Cambios chicos y enfocados; mantené consistencia con lo existente.
- Usá logger (Winston) en vez de `console.log`.

### Don’t

- No corras builds/tests ni comandos destructivos salvo pedido explícito.
- No edites código generado de Prisma (`packages/shared/src/generated/prisma/*`).
- En Discord.js v14: **NUNCA** uses `ephemeral: true`; usá `flags: [MessageFlags.Ephemeral]`.

## Datos Compartidos (DB)

- DB de dev: SQLite en `packages/shared/dev.db`.
- Prisma se configura en `packages/shared/src/prisma.ts` y se exporta desde `@charlybot/shared`.
- La API usa `import { prisma } from "@charlybot/shared"`.
- El bot, en el código actual, consume la API por HTTP (adapters en `apps/bot/src/infrastructure/api/*`).

## Valkey (Redis-compatible)

- Utilidades/config compartidas: `packages/shared/src/valkey/*`.
- Variables principales: `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, `VALKEY_PREFIX`, `VALKEY_MAX_RETRIES`.
- API y bot inicializan un cliente Valkey con wrapper de fallback.

## Variables De Entorno (referencia rápida)

- Bot: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` (y `GUILD_ID2`, `GUILD_ID3` para scripts), `API_URL`, `API_KEY`, `SPOTIFY_*`, `LOG_LEVEL`, `VALKEY_*`.
- API: `API_KEY` (requerida), `PORT`, `LOG_LEVEL`, `DATABASE_URL`, `VALKEY_*`.

## Docs Por App

- Bot: `apps/bot/AGENTS.md`
- API: `apps/api/AGENTS.md`

## Skills Disponibles

- `skills/discord-command/SKILL.md`: guía para crear comandos slash respetando el patrón del repo.
- `skills/monorepo-versioning/SKILL.md`: reemplaza el flujo de Changesets y guía al agente para versionar workspaces manualmente, actualizar dependencias internas, mantener changelogs, y cerrar el release con commit + tag.

## Flujo de versionado y release

- Para versionar o sacar release del monorepo, seguir `skills/monorepo-versioning/SKILL.md`.
- **NUNCA** usar `changeset add`, `changeset version` ni `.changeset/*.md`.
- El flujo correcto incluye:
  1. plan de release,
  2. confirmación del usuario,
  3. actualización de versiones,
  4. actualización de `CHANGELOG.md` por workspace,
  5. actualización de `CHANGELOG.md` raíz,
  6. creación de artefacto en `releases/`,
  7. commit git,
  8. tags git por workspace (`<workspace>@<version>`).
