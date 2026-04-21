# Release 2026-04-21 - dashboard-guild-fixes

## Packages
- @charlybot/api: 2.6.0 -> 2.6.1 (patch)
- @charlybot/bot: 2.8.2 -> 2.9.0 (minor)

## Reasons
- @charlybot/api: Bugfix — guilds not appearing in dashboard for admin users. Added DELETE endpoint for guild cleanup, owner check in OAuth filter, NaN guard for permissions.
- @charlybot/bot: New feature — automatic guild registration on join (guildCreate) and cleanup on leave (guildDelete). Added deleteGuild to API adapter.

## Internal Dependency Updates
- None (shared was not modified)