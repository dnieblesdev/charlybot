# Release 2026-04-22 — dashboard-ux-and-xp-username

## Packages
- @charlybot/shared: 2.5.1 → 2.5.2
- @charlybot/api: 2.6.2 → 2.6.3
- @charlybot/bot: 2.9.1 → 2.9.2
- dashboard: 0.1.1 → 0.1.2

## Reasons
- @charlybot/shared: Added username field to UserXP model for display names in leaderboard
- @charlybot/api: Fixed guild access middleware (URL path extraction bug), JWT auto-refresh on /auth/me, XP username storage, dashboard 404 handling
- @charlybot/bot: Pass username to XP increment API
- dashboard: Sidebar active state visibility, guild selector card styling, 404 error handling for unconfigured guilds

## Internal Dependency Updates
- @charlybot/api: @charlybot/shared workspace:* → workspace:*
- @charlybot/bot: @charlybot/shared workspace:* → workspace:*
