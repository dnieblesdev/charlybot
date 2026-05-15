---
name: changeset-workflow
description: >
  Automates the changeset versioning workflow for pnpm monorepos. Uses `pnpm exec changeset add --empty` to create changeset templates, then edits them with package bumps and descriptions. Includes the full git workflow from branch to release.
  Trigger: When user wants to version packages, run changeset, "versionear", "preparar release", or create a release.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- User says "changeset", "versionear", "preparar release", "crear release"
- User wants to bump package versions after completing changes
- User asks to document what changed before merging

## Critical Patterns

### ALWAYS

| Rule | Why |
|------|-----|
| Use `pnpm exec changeset add --empty` (never interactive `pnpm exec changeset add` without `--empty`) | The interactive CLI hangs with AI agents |
| List `.changeset/` after `--empty` to find the generated file | File names are random: `adjective-noun-verb.md` |
| Quote scoped package names in YAML: `"@charlybot/bot"` | YAML requires quotes for `@`-prefixed keys |
| Run `pnpm exec changeset version` AFTER all changesets are committed | This bumps package.json versions and updates CHANGELOGs |
| Commit release with `chore(release): ...` message | Conventional commit standard for releases |

### NEVER

| Rule | Consequence |
|------|-------------|
| Run `pnpm exec changeset add` without `--empty` | Interactive prompts hang the agent indefinitely |
| Forget to commit changeset `.md` files before `pnpm exec changeset version` | Version command won't find uncommitted changesets |
| Push branches other than `master` | `develop` stays local/CI; only `master` goes to remote |
| Use `changeset` CLI for the version commit message | Use `git commit -m "chore(release): ..."` manually |

### Format After `--empty`

The `--empty` flag creates a file with empty frontmatter:
```markdown
---
---
```

The agent must edit it to:

```markdown
---
"@charlybot/shared": minor
"@charlybot/api": patch
---

- Description of changes
- Bullet points for changelog
```

## Git Workflow (Complete)

```
1. Branch from develop
   git checkout develop
   git checkout -b feat/my-feature

2. Make changes → verify → commit
   git add -A
   git commit -m "feat(scope): description"

3. Create changeset
   pnpm exec changeset add --empty
   # → creates .changeset/random-name.md
   # List files to find it:
   ls .changeset/*.md
   # Edit the file with package bumps + description
   git add .changeset/
   git commit -m "chore: add changeset"

4. Merge to develop
   git checkout develop
   git merge feat/my-feature

5. User tests → iterate if needed
   # If bugs found: create fix/ branch, repeat steps 2-4

6. Version and release
   pnpm exec changeset version
   git add -A
   git commit -m "chore(release): vX.Y.Z"

7. Merge to master and push
   git checkout master
   git merge develop
   git push origin master
   # ONLY master is pushed to remote

8. (Optional) Docker reload
   # Ask user before reloading containers
   docker compose -f docker/docker-compose.dev.yml up -d --build
```

## Version Type Selection

| Change | Bump | Example |
|--------|------|---------|
| Breaking change (API removed, env var required) | `major` | `"@charlybot/api": major` |
| New feature (new command, new endpoint) | `minor` | `"@charlybot/bot": minor` |
| Bug fix only | `patch` | `"@charlybot/shared": patch` |

## Commands

```bash
# Create empty changeset
pnpm exec changeset add --empty

# Find the generated file
ls .changeset/*.md

# Run versioning (after all changesets committed)
pnpm exec changeset version

# Check version changes
git diff packages/*/package.json apps/*/package.json

# Commit release
git add -A
git commit -m "chore(release): vX.Y.Z"
```

## Common Issues

### "pnpm exec changeset add hangs"
→ Never use without `--empty`. Always `pnpm exec changeset add --empty`.

### "Which packages to include?"
→ Check `git diff --name-only HEAD~1` for modified packages in `packages/` and `apps/`.

### "What if multiple packages changed?"
→ List ALL changed packages in the same changeset file frontmatter, one per line.

## Resources

- **Changesets Docs**: https://github.com/changesets/changesets