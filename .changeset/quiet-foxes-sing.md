---
"dashboard": minor
---

Security: Cookie-based auth, remove API key, add pagination UI

- Removed API key injection from interceptor (no more X-API-Key in frontend)
- Removed token management from AuthService (no sessionStorage/localStorage for tokens)
- Auth relies on HttpOnly cookies sent automatically by browser
- Simplified callback component — no URL hash parsing for tokens
- Economy leaderboard now supports pagination with prev/next controls
- Users leaderboard now supports pagination with prev/next controls
- Removed `apiKey` from environment files
