# charlybot

## 2026-04-22

### @charlybot/shared (2.5.2)
- Add `username` field to UserXP model
- Update XPIncrementSchema with optional username

### @charlybot/api (2.6.3)
- Fix guildAccessMiddleware: extract guildId from URL path (was matching wildcard routes)
- Auto-refresh JWT on /auth/me with current bot guilds
- Store username in XP increment endpoint
- Handle 404 gracefully in dashboard config endpoints

### @charlybot/bot (2.9.2)
- Pass username to XP increment API call

### dashboard (0.1.2)
- Fix sidebar active state: left border indicator + improved contrast
- Enhance guild selector cards: larger icons, shadow, hover lift
- Handle 404 on config endpoints gracefully
- Fix overview paginated response extraction

## 2026-04-21 (v2)

### @charlybot/api (2.6.2)
- Fix BigInt precision loss in Discord permission checks
- Add GET /api/v1/guilds debug endpoint
- Enhance OAuth logging with per-guild permission breakdown

### @charlybot/bot (2.9.1)
- Fix ready.ts: fetchOwner failure no longer blocks guild registration
- Replace Promise.all with sequential for-of to avoid rate limit bursts

### dashboard (0.1.1)
- Fix auth guard: always validate session via fetchProfile()
- Remove auto-navigate — always show server selection panel
- Add loading state to AuthService

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