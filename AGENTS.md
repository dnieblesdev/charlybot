# AGENTS.md — CharlyBot (monorepo)

Context for AI agents working on this monorepo. Read this in full before making changes.

## TL;DR

- Monorepo with **Node.js 22 + TypeScript (ESM)**.
- Apps: `apps/bot` (Discord.js v14) and `apps/api` (Hono).
- Shared package: `packages/shared` (Prisma + Zod schemas + observability).
- Persistence: Prisma (LibSQL/SQLite) via `@charlybot/shared`. Bot and API use Prisma directly.

## Start Here

> **Component AGENTS.md override root rules within their scope.**
> When guidance conflicts, the more specific file wins.

- Working on `apps/bot/`? → Read `apps/bot/AGENTS.md` first.
- Working on `apps/api/`? → Read `apps/api/AGENTS.md` first.
- Working on `packages/shared/`? → Read `packages/shared/AGENTS.md` first.
- Cross-cutting concerns (git, releases, general patterns)? → This file.

## Design System

This project follows the `DESIGN.md` specification — a design system document that AI agents read to generate consistent UI across the monorepo.

**Before writing ANY UI code** (styles, components, layouts, Tailwind classes), read `DESIGN.md` at the repository root. It defines the canonical colors, typography, spacing, shapes, and component patterns shared by `apps/landing/` and `apps/dashboard/`.

| App | CSS Strategy | DESIGN.md Section |
|-----|-------------|-------------------|
| `apps/landing/` | Pure CSS — semantic classes in `src/styles.css` | Components — Landing |
| `apps/dashboard/` | Tailwind CSS 4 — `@theme` tokens in `src/styles.css` | Components — Dashboard |

The `DESIGN.md` YAML front matter contains machine-readable design tokens. The markdown body contains human-readable rationale and component composition rules.

## Structure

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

## Quick Commands

```bash
pnpm install
pnpm dev          # API + Bot in parallel
pnpm dev:api
pnpm dev:bot
pnpm rc           # register slash commands
pnpm cc           # clear slash commands
pnpm lc           # list registered commands
pnpm db:backup
pnpm db:migrate
pnpm db:push
pnpm db:restore
```

## Cross-Cutting Rules

- **Logger**: Use Winston (`logger` or `createLogger()`), never `console.log`.
- **No generated Prisma**: Do not edit files in `packages/shared/src/generated/prisma/`.
- **Test policy**: NEVER run tests unless the user explicitly requests it.
  - **EXCEPTION**: in `apps/bot/`, you may run `pnpm --filter @charlybot/bot test` (vitest) when editing commands.
- **No destructives**: Do not run build/test or destructive commands unless explicitly requested.

## Available Skills

### CharlyBot-Specific Skills

| Skill | Scope | Trigger | URL |
|-------|-------|---------|-----|
| `discord-command` | bot | Create slash commands, add subcommands | [SKILL.md](skills/discord-command/SKILL.md) |
| `changeset-workflow` | root, bot, api, shared | Version, release, changeset add/version | [SKILL.md](skills/changeset-workflow/SKILL.md) |
| `prisma-migration` | root, shared | Run Prisma migrations with pre-backup, fix tsx/dotenv issues | [SKILL.md](skills/prisma-migration/SKILL.md) |

### Repo Skills

| Skill | Scope | Trigger | URL |
|-------|-------|---------|-----|
| `hono` | api | Hono routes, middleware, entry point | [SKILL.md](skills/hono/SKILL.md) |
| `zod` | api, shared | Zod schemas, validation | [SKILL.md](skills/zod/SKILL.md) |
| `prisma-client-api` | api, bot, shared | Prisma models, queries, DB operations | [SKILL.md](skills/prisma-client-api/SKILL.md) |
| `vitest` | bot, api | Tests with vitest | [SKILL.md](skills/vitest/SKILL.md) |
| `typescript-advanced-types` | bot, api, shared | TypeScript code, types, utilities | [SKILL.md](skills/typescript-advanced-types/SKILL.md) |
| `pr_review` | root | Review PRs and Issues | [SKILL.md](skills/pr_review/SKILL.md) |
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

When you perform these actions, load the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| Create Discord slash commands | `discord-command` |
| Version or prepare release | `changeset-workflow` |
| Review PRs | `pr_review` |
| Write tests | `vitest` |
| Work with Prisma models | `prisma-client-api` |
| Use Prisma CLI (generate, migrate, push) | `prisma-cli` |
| Run Prisma migrations in monorepo | `prisma-migration` |
| Configure Prisma database provider | `prisma-database-setup` |
| Work with Prisma Postgres | `prisma-postgres` |
| Create Zod schemas | `zod` |
| Write Hono routes | `hono` |
| Write TypeScript, types, utilities | `typescript-advanced-types` |
| Work on the dashboard (Angular) | `angular-developer` |
| Angular architecture, project structure | `reference-core` |
| Use Angular compiler-cli (ngtsc) | `reference-compiler-cli` |
| Work with Angular Signal Forms | `reference-signal-forms` |
| Style with Tailwind CSS | `tailwind-css-patterns` |
| Design UI components | `frontend-design` |
| Configure Vite, plugins, SSR | `vite` |
| Optimize SEO, structured data | `seo` |
| Audit accessibility (WCAG 2.2) | `accessibility` |

## Git / PR Conventions

- Conventional commits: `fix(scope):`, `feat(scope):`, `chore:`.
- Branch naming: `feat/<description>`, `fix/<description>`, `chore/<description>`.
- NEVER commit files that contain secrets (`.env`, credentials.json).
- Only `master` is pushed to remote. `develop` stays local/CI.

## Docs per Component

| Component | File |
|------------|-------|
| Bot | `apps/bot/AGENTS.md` |
| API | `apps/api/AGENTS.md` |
| Shared | `packages/shared/AGENTS.md` |
