# charlybot

## 2026-04-21

### @charlybot/api (2.6.1)
- Add DELETE endpoint for guild cleanup (atomic + idempotent)
- Add guild.owner check in OAuth admin filter
- Add NaN guard for empty permissions string

### @charlybot/bot (2.9.0)
- Add guildCreate event handler for automatic guild registration
- Add guildDelete event handler for guild cleanup on leave
- Add deleteGuild method to HttpGuildConfigAdapter and repository
- Add guild.available guard to prevent data loss during Discord outages
- Add memberCount null guard and fetchOwner fallback in guildCreate