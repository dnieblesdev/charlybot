# Release 2026-04-21 - dashboard-guild-fixes-v2

## Packages
- @charlybot/api: 2.6.1 -> 2.6.2 (patch)
- @charlybot/bot: 2.9.0 -> 2.9.1 (patch)
- dashboard: 0.1.0 -> 0.1.1 (patch)

## Reasons
- @charlybot/api: Fix BigInt precision loss in Discord permission checks (permissions exceed MAX_SAFE_INTEGER caused admin users to be filtered out). Add debug endpoint GET /api/v1/guilds. Enhance OAuth logging.
- @charlybot/bot: Fix ready.ts guild sync — fetchOwner failure blocked guild registration, causing dashboard to show only owner guilds. Replace Promise.all with sequential loop to avoid rate limit bursts.
- dashboard: Fix auth guard to always validate session via fetchProfile() and get fresh guild data. Remove auto-navigate effect from guild selector so users always see server selection panel.

## Internal Dependency Updates
- None (shared was not modified, workspace:* preserved)
