---
"@charlybot/bot": patch
---

Update bot Dockerfile for Docker production deployment

- Run bot directly with `bun run src/index.ts` instead of build+node
- Fix Dockerfile COPY paths for project root context
