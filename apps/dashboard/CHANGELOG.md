# dashboard

## 0.1.1

### Patch Changes

- Fix auth guard: always call fetchProfile() to validate session and get fresh guild data
- Remove auto-navigate effect from guild selector — always show server selection panel
- Add loading signal to AuthService for async profile fetch state

## 0.1.0

### Minor Changes

- d8581af: Initial release — Angular 21 admin dashboard with Discord auth
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

- 4f467a1: Security: Cookie-based auth, remove API key, add pagination UI
  - Removed API key injection from interceptor (no more X-API-Key in frontend)
  - Removed token management from AuthService (no sessionStorage/localStorage for tokens)
  - Auth relies on HttpOnly cookies sent automatically by browser
  - Simplified callback component — no URL hash parsing for tokens
  - Economy leaderboard now supports pagination with prev/next controls
  - Users leaderboard now supports pagination with prev/next controls
  - Removed `apiKey` from environment files
