# Context Propagation

`request_id` MUST propagate automatically to ALL logs within an operation. Agents MUST NOT pass IDs manually between every log call.

## API (HTTP)

- Request headers: `X-Request-ID`
- AsyncLocalStorage for async context
- Child loggers with `request_id` as default field

Always include `request_id` in every log entry so you can trace a full request.

## Bot (Discord.js)

Discord interactions carry their own context:

- `interaction.id` — interaction ID (use as correlation)
- `interaction.token` — ephemeral token (**do NOT log**)
- `interaction.user.id` — user ID
- `interaction.guildId` — guild ID

Generate a `request_id` per interaction handler. Include `user_id` and `guild_id` in every log entry.
