# AGENTS.md — CharlyBot (monorepo)

Contexto para agentes de IA trabajando en este monorepo. Leelo completo antes de generar cambios.

## TL;DR

- Monorepo con **Bun + TypeScript (ESM)**.
- Apps: `apps/bot` (Discord.js v14) y `apps/api` (Hono).
- Paquete compartido: `packages/shared` (Prisma + Zod schemas + observability).
- Persistencia: Prisma (LibSQL/SQLite) via `@charlybot/shared`. Bot y API usan Prisma directamente.

## Start Here

> **Component AGENTS.md override root rules within their scope.**
> When guidance conflicts, the more specific file wins.

- Working on `apps/bot/`? → Read `apps/bot/AGENTS.md` first.
- Working on `apps/api/`? → Read `apps/api/AGENTS.md` first.
- Working on `packages/shared/`? → Read `packages/shared/AGENTS.md` first.
- Cross-cutting concerns (git, releases, general patterns)? → This file.

## Estructura

```
apps/
  api/         ← Hono HTTP API
  bot/         ← Discord.js bot
  landing/     ← Landing page
  dashboard/   ← Dashboard
packages/
  shared/      ← Prisma client, schemas, observability, Valkey utils
scripts/
  db/          ← DB migration wrappers
  registerCommands.ts
  clearCommands.ts
  listRegistered.ts
docker/
  docker-compose.dev.yml
skills/        ← repo-specific skills (also see <available_skills> in system prompt)
```

## Comandos Rápidos

```bash
bun install
bun run dev          # API + Bot en paralelo
bun run dev:api
bun run dev:bot
bun run rc           # register slash commands
bun run cc           # clear slash commands
bun run lc           # list registered commands
bun run db:backup
bun run db:migrate
bun run db:push
bun run db:restore
```

## Reglas Transversales

- **Logger**: Usá Winston (`logger` o `createLogger()`), nunca `console.log`.
- **No Prisma generado**: No edités archivos en `packages/shared/src/generated/prisma/`.
- **Test policy**: NUNCA corras tests salvo que el usuario lo pida explícitamente.
  - **EXCEPTION**: en `apps/bot/`, podés correr `bun run test` (vitest) cuando editás comandos.
- **No destructivos**: No corras build/test ni comandos destructivos salvo pedido explícito.

## Skills Disponibles

### Skills Específicas de CharlyBot

| Skill | Scope | Trigger | URL |
|-------|-------|---------|-----|
| `discord-command` | bot | Crear comandos slash, agregar subcomandos | [SKILL.md](skills/discord-command/SKILL.md) |
| `changeset-workflow` | root, bot, api, shared | Versionar, release, changeset add/version | [SKILL.md](skills/changeset-workflow/SKILL.md) |

### Skills del Repo

| Skill | Scope | Trigger | URL |
|-------|-------|---------|-----|
| `hono` | api | Rutas Hono, middleware, entry point | [SKILL.md](skills/hono/SKILL.md) |
| `zod` | api, shared | Schemas Zod, validación | [SKILL.md](skills/zod/SKILL.md) |
| `prisma-client-api` | api, bot, shared | Modelos Prisma, queries, operaciones DB | [SKILL.md](skills/prisma-client-api/SKILL.md) |
| `vitest` | bot, api | Tests con vitest | [SKILL.md](skills/vitest/SKILL.md) |
| `typescript-advanced-types` | bot, api, shared | Código TypeScript, tipos, utilidades | [SKILL.md](skills/typescript-advanced-types/SKILL.md) |
| `bun` | todos | Runtime, package manager, bundler | [SKILL.md](skills/bun/SKILL.md) |
| `pr_review` | root | Revisar PRs e Issues | [SKILL.md](skills/pr_review/SKILL.md) |
| `vite` | landing, dashboard | Vite config, plugins, SSR | [SKILL.md](skills/vite/SKILL.md) |
| `angular-developer` | dashboard | Angular components, signals, forms, routing | [SKILL.md](skills/angular-developer/SKILL.md) |
| `tailwind-css-patterns` | landing, dashboard | Tailwind CSS styling, responsive | [SKILL.md](skills/tailwind-css-patterns/SKILL.md) |
| `frontend-design` | landing, dashboard | Frontend design, distinctive UI | [SKILL.md](skills/frontend-design/SKILL.md) |
| `prisma-cli` | shared | Prisma CLI commands, init, generate, migrate | [SKILL.md](skills/prisma-cli/SKILL.md) |
| `prisma-database-setup` | shared | Prisma database provider setup | [SKILL.md](skills/prisma-database-setup/SKILL.md) |
| `prisma-postgres` | shared | Prisma Postgres, create-db, Management API | [SKILL.md](skills/prisma-postgres/SKILL.md) |
| `reference-core` | dashboard | Angular core architecture | [SKILL.md](skills/reference-core/SKILL.md) |
| `reference-compiler-cli` | dashboard | Angular compiler-cli ngtsc | [SKILL.md](skills/reference-compiler-cli/SKILL.md) |
| `reference-signal-forms` | dashboard | Angular Signal Forms | [SKILL.md](skills/reference-signal-forms/SKILL.md) |
| `seo` | landing | SEO optimization, structured data | [SKILL.md](skills/seo/SKILL.md) |
| `accessibility` | landing, dashboard | Accessibility audit, WCAG 2.2 | [SKILL.md](skills/accessibility/SKILL.md) |


## Auto-Invoke Skills

Cuando hagas estas acciones, cargá el skill correspondiente PRIMERO:

| Action | Skill |
|--------|-------|
| Crear comandos slash de Discord | `discord-command` |
| Versionar o preparar release | `changeset-workflow` |
| Hacer review de PRs | `pr_review` |
| Escribir tests | `vitest` |
| Trabajar con modelos Prisma | `prisma-client-api` |
| Usar Prisma CLI (generate, migrate, push) | `prisma-cli` |
| Configurar provider de base de datos Prisma | `prisma-database-setup` |
| Trabajar con Prisma Postgres | `prisma-postgres` |
| Crear schemas Zod | `zod` |
| Escribir rutas Hono | `hono` |
| Escribir TypeScript, tipos, utilidades | `typescript-advanced-types` |
| Trabajar con Bun, instalar paquetes | `bun` |
| Trabajar en el dashboard (Angular) | `angular-developer` |
| Arquitectura Angular, estructura de proyectos | `reference-core` |
| Usar Angular compiler-cli (ngtsc) | `reference-compiler-cli` |
| Trabajar con Angular Signal Forms | `reference-signal-forms` |
| Estilizar con Tailwind CSS | `tailwind-css-patterns` |
| Diseñar UI components | `frontend-design` |
| Configurar Vite, plugins, SSR | `vite` |
| Optimizar SEO, structured data | `seo` |
| Auditar accesibilidad (WCAG 2.2) | `accessibility` |

## Convenciones Git / PR

- Conventional commits: `fix(scope):`, `feat(scope):`, `chore:`.
- Branch naming: `feat/<description>`, `fix/<description>`, `chore/<description>`.
- NUNCA hacer commit de archivos que contengan secretos (`.env`, credenciales.json).
- Solo `master` se pushpea a remote. `develop` queda local/CI.

## Docs por Componente

| Componente | Archivo |
|------------|---------|
| Bot | `apps/bot/AGENTS.md` |
| API | `apps/api/AGENTS.md` |
| Shared | `packages/shared/AGENTS.md` |
