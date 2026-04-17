---
"@charlybot/api": minor
---

Add Discord OAuth2 + JWT authentication

- Add `/api/v1/auth/login` — redirect to Discord OAuth2
- Add `/api/v1/auth/callback` — exchange code for JWT tokens
- Add `/api/v1/auth/me` — user profile + filtered guilds
- Add `/api/v1/auth/refresh` — refresh access token
- Add `/api/v1/auth/logout` — invalidate session
- Add JWT middleware with `jose` library
- Add Discord OAuth2 service (exchange code, fetch user/guilds)
- Add Valkey session storage with 7-day TTL
