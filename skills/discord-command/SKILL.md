---
name: discord-command
description: >
  Crea comandos slash para CharlyBot siguiendo la convención de carpeta con index.ts
  y subcomandos separados, usando el patrón de autorole/ como referencia.
  Trigger: Cuando el usuario pide crear un comando slash nuevo en CharlyBot.
metadata:
  author: charlybot
  version: "1.0"
---

## When to Use

- Usuario pide crear un nuevo comando slash (`/algo`)
- Usuario pide agregar subcomandos a un comando existente
- Cualquier feature nueva que requiera interacción vía chat en Discord

## Critical Patterns

### Estructura OBLIGATORIA de carpetas

```
apps/bot/src/app/commands/<nombre>/
├── index.ts          ← SlashCommandBuilder + router switch
├── <subcomando1>.ts  ← lógica del subcomando
├── <subcomando2>.ts
└── ...
```

**NUNCA** crear un comando como archivo plano (`apps/bot/src/app/commands/micomando.ts`).
Eso es el patrón legacy. Siempre usar carpeta.

### index.ts — estructura fija

```typescript
import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { execute as subcomando1 } from "./subcomando1";
import { execute as subcomando2 } from "./subcomando2";

export const data = new SlashCommandBuilder()
  .setName("nombre")
  .setDescription("Descripción del comando")
  // Permisos (omitir si es para todos los usuarios)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName("subcomando1").setDescription("Hace X")
  )
  .addSubcommand((sub) =>
    sub.setName("subcomando2").setDescription("Hace Y")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "subcomando1":
      await subcomando1(interaction);
      break;
    case "subcomando2":
      await subcomando2(interaction);
      break;
    default:
      await interaction.reply({ content: "Comando no reconocido.", flags: [MessageFlags.Ephemeral] });
  }
}
```

### Subcomando — estructura fija

```typescript
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import logger from "../../../utils/logger";
// importar repository si necesita DB:
// import * as MiRepo from "../../../config/repositories/MiRepo";

export async function execute(interaction: ChatInputCommandInteraction) {
  // Siempre defer antes de operaciones async largas
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    // lógica aquí

    await interaction.editReply({ content: "✅ Hecho." });
  } catch (error) {
    logger.error("Error en subcomando1", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.editReply({ content: "❌ Ocurrió un error." });
  }
}
```

## Reglas de respuestas privadas (efímeras)

**Siempre** usar `flags: [MessageFlags.Ephemeral]`. Importar `MessageFlags` desde `discord.js`.
**NUNCA** usar `ephemeral: true` — está deprecado en Discord.js v14 moderno.

```typescript
// ✅ Correcto — reply directo
await interaction.reply({ content: "Solo vos lo ves.", flags: [MessageFlags.Ephemeral] });

// ✅ Correcto — defer efímero
await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

// ❌ Incorrecto — deprecado
await interaction.reply({ content: "...", ephemeral: true });
await interaction.deferReply({ ephemeral: true });
```

## Reglas de customId

**NUNCA** hardcodear strings de customId. Siempre usar `CUSTOM_IDS.*` de `apps/bot/src/app/interactions/customIds.ts`.

**Formato:** `feature:action[:payload]` con `:` como separador estructural.

```typescript
import { CUSTOM_IDS, parseCustomId } from "../../interactions/customIds";

// ✅ Correcto — crear botón
new ButtonBuilder()
  .setCustomId(CUSTOM_IDS.verification.APPROVE(userId))

// ✅ Correcto — parsear en handler
const { action, payload } = parseCustomId(interaction.customId);

// ❌ Incorrecto — string hardcodeado
new ButtonBuilder().setCustomId(`verification_approve_${userId}`)
```

Si el comando nuevo genera botones/modales/selects:
1. Agregar constantes en `src/app/interactions/customIds.ts`
2. Crear `src/app/interactions/handlers/<feature>.handler.ts`
3. Agregar `case FEATURES.<FEATURE>:` al switch en `interactionCreate.ts`

## Reglas de DB

- **NUNCA** importar `prisma` directamente en commands o services
- Siempre ir a través de un repository en `apps/bot/src/config/repositories/`
- Si la feature necesita un modelo nuevo: schema → migrate → repository → usar en el subcomando

```typescript
// ✅ Correcto
import * as MiRepo from "../../../config/repositories/MiRepo";

// ❌ Incorrecto
import { prisma } from "../../../infrastructure/storage";
```

## Reglas de botones / modales / selects

Si el comando genera botones, modales o select menus:

1. Agregar constantes en `src/app/interactions/customIds.ts`
2. Crear `src/app/interactions/handlers/<feature>.handler.ts`
3. Agregar `case FEATURES.<FEATURE>:` al switch en `interactionCreate.ts`

```typescript
// En interactionCreate.ts, dentro del switch de features:
case FEATURES.MI_FEATURE:
  await miFeatureHandler.handleButton(interaction);
  break;
```

## Reglas de logger

```typescript
import logger from "../../../utils/logger";

// NUNCA console.log — siempre logger
logger.info("Mensaje", { userId: interaction.user.id, guildId: interaction.guildId });
logger.error("Error", { error: error instanceof Error ? error.message : String(error) });
```

## Checklist antes de terminar

- [ ] Carpeta `apps/bot/src/app/commands/<nombre>/` creada con `index.ts`
- [ ] Exports nombrados `data` y `execute` en `index.ts`
- [ ] Un archivo por subcomando
- [ ] `deferReply` antes de cualquier operación async
- [ ] Usar logger, nunca `console.log`
- [ ] Si tiene DB: repository creado en `apps/bot/src/config/repositories/`
- [ ] Si tiene botones/modales: handler registrado en `interactionCreate.ts`
- [ ] Permisos definidos en `SlashCommandBuilder` si aplica

## Resources

- **Referencia de proyecto**: [agents.md](../../apps/bot/agents.md)
- **Ejemplo real**: [apps/bot/src/app/commands/autorole/](../../apps/bot/src/app/commands/autorole/)
- **Template index.ts**: [assets/index-template.ts](assets/index-template.ts)
- **Template subcomando**: [assets/subcommand-template.ts](assets/subcommand-template.ts)
