---
"dashboard": minor
---

Initial release — Angular 21 admin dashboard with Discord auth

- Angular 21 standalone app with zoneless change detection
- Tailwind CSS 4 via PostCSS
- Discord OAuth2 login flow (callback, token storage, JWT)
- Guild selector with admin permission filtering
- Dashboard layout (sidebar + topbar + router-outlet)
- 8 feature components: overview, config, economy, users, music, moderation, autoroles, classes
- Auth guard + guild admin guard
- Auth interceptor with JWT injection + 401 refresh
- Docker multi-stage build (bun → nginx)
- Shared UI components (stat-card, data-table, loader, alert)
