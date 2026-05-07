# AGENTS.md — CharlyBot Bot (`apps/bot`)

Context for AI agents working on the bot. Read this in full before making any changes.

## Scope Rule

- Used 2+ workspaces → `packages/shared/`
- Used only in bot → `apps/bot/src/`
- Used only in api → `apps/api/src/`

## CRITICAL RULES

### ALWAYS

| # | Rule | Why |
|---|------|-----|
| 1 | Use `flags: [MessageFlags.Ephemeral]` for private replies | `ephemeral: true` is deprecated in Discord.js v14 |
| 2 | Use `CUSTOM_IDS.*` from `src/app/interactions/customIds.ts` | Avoids hardcoded strings and ensures consistency across handlers |
| 3 | Call `deferReply()` before long async operations | Prevents Discord interaction timeout |
| 4 | Use `logger` (Winston) instead of `console.log` | Structured logs with levels, persists to file |
| 5 | Use `createLogger()` from `@charlybot/shared` | Consistent with API logging format |
| 6 | Follow folder pattern for new commands (`commands/<name>/index.ts`) | Convention used by the loader to discover commands |
| 7 | Import from `src/config/repositories/` for data access | Enforces boundary between data access and business logic |

### NEVER

| # | Rule | Consequence |
|---|------|-------------|
| 1 | Use `ephemeral: true` | Deprecated in Discord.js v14, silently fails |
| 2 | Hardcode `customId` strings | Breaks interaction parsing consistency |
| 3 | Import `prisma` outside of repositories | Keep data access in `src/config/repositories/`; services/commands go through repos |
| 4 | Create flat-file commands (e.g., `commands/micommand.ts`) | Loader requires folder structure with `index.ts` |
| 5 | Forget `deferReply()` before async | Interaction times out, user sees "loading" forever |

## TL;DR

- Stack: **TypeScript + Bun + Discord.js v14**.
- Entry: `src/index.ts` imports `src/app/core/index.ts`.
- Commands new: folder + `index.ts` + subcommands (pattern `src/app/commands/autorole/`).
- Interactions: `customId` ALWAYS via `CUSTOM_IDS.*` (no hardcoded strings).
- Private replies: `flags: [MessageFlags.Ephemeral]` (NEVER `ephemeral: true`).
- Persistence: bot uses **Prisma directly** via `@charlybot/shared` (repositories in `src/config/repositories/`).

## Tech Stack

| | |
|---|---|
| Runtime | Bun |
| Language | TypeScript (ESM) |
| Discord | Discord.js v14 |
| Logger | Winston via `@charlybot/shared` |
| Tests | vitest (pool: forks) |
| HTTP Client | Custom ApiClient (`src/infrastructure/api/ApiClient.ts`) |
| Metrics | Express + prom-client (exposed at `/metrics`) |

## What Is This Project

Multi-feature Discord bot with music, economy, verification, AutoRole, and more systems. The bot uses Prisma directly from `@charlybot/shared`. Data is accessed via repositories in `src/config/repositories/`. The API (`apps/api`) still exists but the bot does not depend on it for persistence.

## Bot Systems

| System | What it does | Main commands |
|---|---|---|
| Music | Plays YouTube/Spotify via `play-dl` + `yt-dlp` with queue, loops, shuffle | `/play`, `/skip`, `/queue`, `/nowplaying`, `/pause`, `/resume`, `/stop`, `/loop`, `/shuffle`, `/volume`, `/join`, `/leave` |
| Verification | Panel with button → registration modal → moderator review → role assignment | `/setup-verification`, `/send-verification-panel`, `/list-pending-verifications` |
| AutoRole | Role assignment by reaction or button on configurable messages | `/autorole setup/list/edit/remove` |
| Economy | Per-server wallet, global bank, work, crime, rob, roulette, leaderboard | `/economia balance`, `/economia deposit`, `/economia retirar`, `/economia work`, `/economia crime`, `/economia rob`, `/economia ruleta`, `/economia leaderboard`, `/economia bail` |
| Config | Per-server configuration (log channels, welcome, verification, etc.) | `/set-welcome`, `/set-voice-log-channel`, `/set-image-channel`, `/show-config` |
| Logs | Voice events, member join/leave, messages | Automatic via events |
| Classes | Hierarchical role system (type → class → subclass) | `/addClass`, `/listClasses`, `/removeClass` |

## Structure (Actual)

```
src/
  index.ts                     ← imports app/core/index.ts
  app/
    core/
      DiscordClient.ts         ← discord.js Client wrapper
      index.ts                 ← bootstrap: ffmpeg/Spotify, Valkey/streams, startup
    loader.ts                  ← dynamic loader for commands and events
    commands/                  ← slash commands (folders with index.ts)
    events/                    ← event handlers (router in interactionCreate.ts)
    interactions/
      customIds.ts             ← CUSTOM_IDS, FEATURES, parseCustomId()
      handlers/
    services/                  ← business logic
  infrastructure/
    api/                       ← HTTP client + adapters toward apps/api
    valkey/                    ← Valkey lifecycle (wrapper with fallback)
    streams/                   ← music streams (Valkey)
    monitoring/
      health.ts                ← Express server for /metrics (prom-client)
    storage/                   ← NOT IN USE (see technical debt)
  config/
    repositories/              ← data access boundary (via API adapters)
  utils/
    logger.ts                  ← Winston logger (always use)
  types/
```

## Express Metrics Server

The bot exposes a `/metrics` endpoint via an internal Express server (`src/infrastructure/monitoring/health.ts`).

```typescript
// GET /metrics → prom-client scrape endpoint
// GET /health → { ok: true, uptime: number }
```

This is separate from the main Discord client lifecycle. It's used for observability (Prometheus scraping). The bot's own metrics (event counts, command latency, error rates) are registered via `createMetricsRegistry()` from `@charlybot/shared`.

## Standard Command Pattern (REQUIRED)

Every new command must follow the structure of `src/app/commands/autorole/`:

```
src/app/commands/<command-name>/
  index.ts          ← SlashCommandBuilder + export { data, execute } + router
  <subcommand1>.ts  ← export async function execute(interaction)
  <subcommand2>.ts
```

### `index.ts` (minimal structure)

```ts
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { execute as subcommand1 } from "./subcommand1";

export const data = new SlashCommandBuilder()
  .setName("name")
  .setDescription("Description")
  .addSubcommand((sub) => sub.setName("subcommand1").setDescription("Does X"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "subcommand1":
      await subcommand1(interaction);
      break;
  }
}
```

### Command rules

- `data` and `execute` are mandatory named exports (the loader detects them this way).
- If the command exposes `init(client)`, it is called at startup (useful for recovering state).
- For private replies: always `flags: [MessageFlags.Ephemeral]`.
- **NEVER** `ephemeral: true`.
- For long tasks: `await interaction.deferReply(...)`.

## Interaction Handling (buttons, modals, selects)

Central router: `src/app/events/interactionCreate.ts`.

### `customId` convention

Format: `feature:action[:payload]`

- `:` is the only structural separator.
- `_` can exist inside the payload but not as a separator.

Rule: **NEVER** hardcode strings. Always use `CUSTOM_IDS.*` from `src/app/interactions/customIds.ts`.

```ts
import { CUSTOM_IDS, parseCustomId } from "../../interactions/customIds";

new ButtonBuilder().setCustomId(CUSTOM_IDS.verification.APPROVE(userId));

const { feature, action, payload } = parseCustomId(interaction.customId);
```

To add a new feature with interactions:

1. Add constants in `src/app/interactions/customIds.ts`.
2. Create `src/app/interactions/handlers/<feature>.handler.ts`.
3. Register the handler in `src/app/events/interactionCreate.ts`.

## Data and Repositories

The bot accesses Prisma directly from `@charlybot/shared`.

- Prisma client: `import { prisma } from "@charlybot/shared"`.
- Repositories: `src/config/repositories/*.ts` (data access boundary for the rest of the bot).

Rule: commands/services should NOT import `prisma` directly; use repositories.

## Logger

Always use Winston (`src/utils/logger.ts` or `@charlybot/shared`) instead of `console.log`.

```ts
import logger from "../../utils/logger";
// or from shared:
import { createLogger } from "@charlybot/shared";

logger.info("Informative message", { ctx: "something" });
logger.warn("Warning");
logger.error("Error", { error: err instanceof Error ? err.message : String(err) });
```

## Valkey

The bot uses Valkey with in-memory fallback.

- Lifecycle: `src/infrastructure/valkey/index.ts`.
- Music streams: `src/infrastructure/streams/*`.

Typical variables: `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, `VALKEY_PREFIX`, `VALKEY_MAX_RETRIES`.

## Docker Dev

`docker/docker-compose.dev.yml` brings up `valkey`, `api` and `bot`.

## Environment Variables (minimum)

- `DISCORD_TOKEN` (required)
- `CLIENT_ID` (required for scripts)
- `GUILD_ID`/`GUILD_ID2`/`GUILD_ID3` (optional; used by registration scripts)
- `API_URL` (default: `http://localhost:3000`)
- `API_KEY` (default: `dev-key`)
- `LOG_LEVEL`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`
- `VALKEY_*`

## Useful Scripts

```bash
bun run dev          # Start the bot (apps/bot)
bun run rc           # Register slash commands (scripts/registerCommands.ts)
bun run cc           # Clear slash commands
bun run lc           # List registered slash commands
```

Note: Command administration scripts live in `scripts/` (root) and are run with Bun.

## Technical Debt (Do Not Extend)

- `src/adapters/StorageAdapter.ts` (empty)
- `src/adapters/AudioAdapter.ts` (empty)
- `src/container.ts` (empty)
- `src/infrastructure/storage/index.ts` (not currently used; the bot consumes the API)

## Tests

The bot uses **vitest** as the test runner with pool `forks` for deterministic isolation. The config lives in `vitest.config.ts` and global setup in `tests/setup.ts`.

### Run tests

```bash
# from apps/bot/
bun test              # run once
bun run test:watch    # watch mode
bun run test:coverage # with coverage report (v8)
```

### File structure

```
apps/bot/
  tests/
    setup.ts              # global setup: mock @charlybot/shared/prisma
    smoke.test.ts         # smoke test (verifies vitest runs)
    economy/              # pure roulette logic tests
      roulette.test.ts
      config.test.ts
      service.test.ts
    commands/economia/
      balance.test.ts
  src/
    __mocks__/
      discord.ts          # createMockChatInputCommandInteraction()
      repo.ts             # createMockEconomyRepo(), createMockConfigRepo()
```

### Mock factories

**`createMockChatInputCommandInteraction(overrides?)`**
Creates a mock of `ChatInputCommandInteraction` with `reply()`, `editReply()`, `deferReply()`, `followUp()` as `vi.fn()`. Overrides `userId`, `guildId`, and `options.*` as needed.

```ts
const interaction = createMockChatInputCommandInteraction({
  userId: "my-user",
  guildId: "my-guild",
  options: { subcommand: "balance" },
});
await interaction.deferReply();
await interaction.editReply({ content: "result" });
```

**`createMockEconomyRepo(overrides?)`**
Creates a mock of the entire `EconomyRepo` namespace with each function as `vi.fn()`. Default behavior: `getEconomyUser` → `null`, `createEconomyUser` → default user with pocket=1000. Override specific functions in each test.

```ts
const repo = createMockEconomyRepo({
  getEconomyUser: vi.fn(() => Promise.resolve({ pocket: 5000 })),
});
```

### Test pattern by layer

| Layer | What to test | Mock |
|-------|-------------|------|
| Pure logic (RouletteService) | Direct function, no mocks | None |
| Config defaults | Service with mocked repo | `vi.mock(".../EconomyRepo")` |
| Service with mocks | Service, repo and LeaderboardService mocked | `vi.mock()` per namespace |
| Command handler | `execute(interaction)` with interaction mock | `createMockChatInputCommandInteraction` |

### Important rules

- **Do not use real database** — all tests use mocks of `EconomyRepo` and `vi.mock("@charlybot/shared")` to replace `prisma`.
- **No `ephemeral: true`** — in command tests, if you need an ephemeral reply, use `flags: [MessageFlags.Ephemeral]`.
- **`vi.clearAllMocks()`** — called automatically in `afterEach` in global setup.
- **`import type`** — use `import type` for types only used as types (required by `verbatimModuleSyntax`).

## Auto-Invoke Skills

| Action | Skill |
|--------|-------|
| Create slash commands | `discord-command` |
| Add subcommands | `discord-command` |
| Version or release | `changeset-workflow` |
| Write tests in bot | `vitest` |
| Work with Prisma models | `prisma-client-api` |
| Write TypeScript | `typescript` |

## QA Checklist

- [ ] Logger used instead of `console.log`
- [ ] `flags: [MessageFlags.Ephemeral]` used (not `ephemeral: true`)
- [ ] `CUSTOM_IDS.*` used for all customId (no hardcoded strings)
- [ ] `deferReply()` called before async operations
- [ ] New commands created as folders with `index.ts` (not flat files)
- [ ] Repository used for data access (Prisma only via repositories, not in services/commands)
- [ ] Tests pass: `bun run test`
- [ ] ESM imports used (no `require()`)
- [ ] No hardcoded strings for interaction identifiers


