---
name: discord-command
description: >
  Creates slash commands for CharlyBot following the folder convention with index.ts
  and separate subcommands, using the autorole/ pattern as reference.
  Trigger: When the user asks to create a new slash command in CharlyBot.
metadata:
  author: charlybot
  version: "1.0"
  scope: [bot]
  auto_invoke:
    - "Creating a slash command"
    - "Adding subcommands to an existing command"
    - "Building Discord bot interactions (buttons, modals, selects)"
---

## When to Use

- User asks to create a new slash command (`/something`)
- User asks to add subcommands to an existing command
- Any new feature that requires interaction via chat in Discord

## Critical Patterns

### REQUIRED folder structure

```
apps/bot/src/app/commands/<name>/
├── index.ts          ← SlashCommandBuilder + router switch
├── <subcommand1>.ts  ← subcommand logic
├── <subcommand2>.ts
└── ...
```

**NEVER** create a command as a flat file (`apps/bot/src/app/commands/mycommand.ts`).
That is the legacy pattern. Always use a folder.

### index.ts — fixed structure

#### Option A: Simple subcommands (no groups)

Use this when commands are flat like `/mod warn`, `/mod timeout`.

```typescript
import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { execute as subcommand1 } from "./subcommand1";
import { execute as subcommand2 } from "./subcommand2";

export const data = new SlashCommandBuilder()
  .setName("name")
  .setDescription("Command description")
  // Permissions (omit if for all users)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName("subcommand1").setDescription("Does X")
  )
  .addSubcommand((sub) =>
    sub.setName("subcommand2").setDescription("Does Y")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "subcommand1":
      await subcommand1(interaction);
      break;
    case "subcommand2":
      await subcommand2(interaction);
      break;
    default:
      await interaction.reply({ content: "Unrecognized command.", flags: [MessageFlags.Ephemeral] });
  }
}
```

#### Option B: Subcommand groups (nested commands)

**CRITICAL**: Use this when you need grouping like `/mod config view`, `/mod config mod-log`.

**Common bug**: `getSubcommand()` returns the leaf name (e.g. `"view"`), NOT the group name. You MUST check `getSubcommandGroup()` first.

```typescript
import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Moderation commands")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand((sub) =>
    sub.setName("warn").setDescription("Warn a user")
  )
  .addSubcommandGroup((group) =>
    group
      .setName("config")
      .setDescription("Configuration")
      .addSubcommand((sub) =>
        sub.setName("view").setDescription("View current config")
      )
      .addSubcommand((sub) =>
        sub.setName("mod-log").setDescription("Set mod log channel")
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();

  // MUST check group first — getSubcommand() returns the leaf, not the group
  if (subcommandGroup) {
    switch (subcommandGroup) {
      case "config": {
        const configSub = interaction.options.getSubcommand();
        const handler = await import(`./config/${configSub}.js`);
        await handler.default(interaction);
        break;
      }
      default:
        await interaction.reply({
          content: "Unrecognized command group.",
          flags: [MessageFlags.Ephemeral],
        });
    }
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "warn": {
      const handler = await import("./warn.js");
      await handler.default(interaction);
      break;
    }
    // ... other flat subcommands
    default:
      await interaction.reply({
        content: "Unrecognized command.",
        flags: [MessageFlags.Ephemeral],
      });
  }
}
```

**Why this matters**: For `/mod config view`, Discord.js returns:
- `getSubcommandGroup()` → `"config"`
- `getSubcommand()` → `"view"`

If you only switch on `getSubcommand()`, `"view"` won't match anything and falls through to default. Always handle groups first.

### Subcommand — fixed structure

```typescript
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import logger from "../../../utils/logger";
// import repository if it needs DB:
// import * as MyRepo from "../../../config/repositories/MyRepo";

export async function execute(interaction: ChatInputCommandInteraction) {
  // Always defer before long async operations
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    // logic here

    await interaction.editReply({ content: "✅ Done." });
  } catch (error) {
    logger.error("Error in subcommand1", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.editReply({ content: "❌ An error occurred." });
  }
}
```

## Ephemeral (private) reply rules

**Always** use `flags: [MessageFlags.Ephemeral]`. Import `MessageFlags` from `discord.js`.
**NEVER** use `ephemeral: true` — it is deprecated in modern Discord.js v14.

```typescript
// ✅ Correct — direct reply
await interaction.reply({ content: "Only you can see this.", flags: [MessageFlags.Ephemeral] });

// ✅ Correct — ephemeral defer
await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

// ❌ Wrong — deprecated
await interaction.reply({ content: "...", ephemeral: true });
await interaction.deferReply({ ephemeral: true });
```

## customId rules

**NEVER** hardcode customId strings. Always use `CUSTOM_IDS.*` from `apps/bot/src/app/interactions/customIds.ts`.

**Format:** `feature:action[:payload]` with `:` as the structural separator.

```typescript
import { CUSTOM_IDS, parseCustomId } from "../../interactions/customIds";

// ✅ Correct — create button
new ButtonBuilder()
  .setCustomId(CUSTOM_IDS.verification.APPROVE(userId))

// ✅ Correct — parse in handler
const { action, payload } = parseCustomId(interaction.customId);

// ❌ Wrong — hardcoded string
new ButtonBuilder().setCustomId(`verification_approve_${userId}`)
```

If the new command generates buttons/modals/selects:
1. Add constants in `src/app/interactions/customIds.ts`
2. Create `src/app/interactions/handlers/<feature>.handler.ts`
3. Add `case FEATURES.<FEATURE>:` to the switch in `interactionCreate.ts`

## DB rules

- **NEVER** import `prisma` directly in commands or services
- Always go through a repository in `apps/bot/src/config/repositories/`
- If the feature needs a new model: schema → migrate → repository → use in the subcommand

```typescript
// ✅ Correct
import * as MyRepo from "../../../config/repositories/MyRepo";

// ❌ Wrong
import { prisma } from "../../../infrastructure/storage";
```

## Button / modal / select rules

If the command generates buttons, modals, or select menus:

1. Add constants in `src/app/interactions/customIds.ts`
2. Create `src/app/interactions/handlers/<feature>.handler.ts`
3. Add `case FEATURES.<FEATURE>:` to the switch in `interactionCreate.ts`

```typescript
// In interactionCreate.ts, inside the features switch:
case FEATURES.MY_FEATURE:
  await myFeatureHandler.handleButton(interaction);
  break;
```

## Logger rules

```typescript
import logger from "../../../utils/logger";

// NEVER console.log — always logger
logger.info("Message", { userId: interaction.user.id, guildId: interaction.guildId });
logger.error("Error", { error: error instanceof Error ? error.message : String(error) });
```

## Checklist before finishing

- [ ] Folder `apps/bot/src/app/commands/<name>/` created with `index.ts`
- [ ] Named exports `data` and `execute` in `index.ts`
- [ ] One file per subcommand
- [ ] `deferReply` before any async operation
- [ ] Use logger, never `console.log`
- [ ] If it has DB: repository created in `apps/bot/src/config/repositories/`
- [ ] If it has buttons/modals: handler registered in `interactionCreate.ts`
- [ ] Permissions defined in `SlashCommandBuilder` if applicable

## Resources

- **Project reference**: [AGENTS.md](../../apps/bot/AGENTS.md)
- **Real example**: [apps/bot/src/app/commands/autorole/](../../apps/bot/src/app/commands/autorole/)
- **Template index.ts**: [assets/index-template.ts](assets/index-template.ts)
- **Template subcommand**: [assets/subcommand-template.ts](assets/subcommand-template.ts)
