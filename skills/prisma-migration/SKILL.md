---
name: prisma-migration
description: "Trigger: Prisma migrate, db push, database migration, schema change. Run Prisma migrations in the CharlyBot monorepo with automatic pre-backup and tsx compatibility."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Skill: prisma-migration

## Activation Contract

Use when:
- The user asks to run a Prisma migration (`migrate dev`, `migrate deploy`, `db push`)
- Schema changes need to be synced to the database
- A script fails with `DISCORD_TOKEN` or env var errors (missing `dotenv`)
- `tsx` throws "Top-level await is currently not supported with the cjs output format"

## Hard Rules

- **ALWAYS** run migrations from the repo root using `pnpm db:migrate` (never `prisma migrate` directly unless debugging)
- **ALWAYS** ensure `dotenv.config()` is present in scripts that need env vars (scripts in `scripts/` don't inherit the bot's `.env` automatically)
- **NEVER** use `await` at top-level in scripts executed by `tsx` — wrap in `(async () => { ... })()`
- The Prisma schema lives at `packages/shared/prisma/schema.prisma`
- The SQLite database is `packages/shared/dev.db`

## Decision Gates

| Need | Action |
|------|--------|
| Apply pending migrations | `pnpm db:migrate` |
| Create a new migration after schema changes | `pnpm db:migrate dev -- --name <name>` |
| Sync schema without migration file | `pnpm db:push` |
| Pre-migration backup | Automatic — `db:migrate` creates one via `scripts/db/backup.ts` |
| Restore from backup | `pnpm db:restore <filepath>` |
| Check migration status | `pnpm exec prisma migrate status --schema=packages/shared/prisma/schema.prisma` |

## Execution Steps

### Running a migration

1. Verify schema is valid: `pnpm --filter @charlybot/shared db:generate`
2. Run the wrapper script: `pnpm db:migrate`
3. If creating a new migration: `pnpm db:migrate dev -- --name add_x_table`

### Fixing a script that fails with missing env vars

If a script in `scripts/` fails with "Faltan DISCORD_TOKEN o CLIENT_ID":

```typescript
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../apps/bot/.env") });
```

### Fixing `tsx` + top-level await

If `tsx scripts/db/migrate.ts` throws "Top-level await is currently not supported":

```typescript
// CLI execution
if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args[0];
    // ... switch/case with await inside ...
  })();
}
```

## Output Contract

Return:
- Confirmation of which script was run
- Path to pre-migration backup (if created)
- Prisma CLI output summary
- Any env/dotenv fixes applied

## References

- `scripts/db/migrate.ts` — migration wrapper with pre-backup
- `scripts/db/backup.ts` — backup creation logic
- `packages/shared/prisma/schema.prisma` — database schema
- `packages/shared/prisma.config.ts` — Prisma configuration
