---
"@charlybot/api": minor
---

Security: HttpOnly cookie auth, guild access middleware, leaderboard pagination

- Auth callback now sets HttpOnly cookies instead of redirecting with tokens in URL
- JWT middleware reads from cookie first, falls back to Authorization header
- Auth middleware dual-mode: JWT cookie OR X-API-Key (backward compat with bot)
- New `/api/v1/auth/logout` endpoint clears cookies
- New `guildAccessMiddleware` validates guild access via JWT payload
- Economy and XP leaderboards now support `?page=&limit=` pagination with `{data, total, page, limit, totalPages}` response
- JwtPayload extended with `guilds: string[]`
