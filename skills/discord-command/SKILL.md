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
src/app/commands/<nombre>/
├── index.ts          ← SlashCommandBuilder + router switch
├── <subcomando1>.ts  ← lógica del subcomando
├── <subcomando2>.ts
└── ...
```

**NUNCA** crear un comando como archivo plano (`src/app/commands/micomando.ts`).
Eso es el patrón legacy. Siempre usar carpeta.

### index.ts — estructura fija

```typescript
import {
  ChatInputCommandInteraction,
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
      await interaction.reply({ content: "Comando no reconocido.", ephemeral: true });
  }
}
```

### Subcomando — estructura fija

```typescript
import { ChatInputCommandInteraction } from "discord.js";
import logger from "../../../utils/logger";
// importar repository si necesita DB:
// import * as MiRepo from "../../../config/repositories/MiRepo";

export async function execute(interaction: ChatInputCommandInteraction) {
  // Siempre defer antes de operaciones async largas
  await interaction.deferReply({ ephemeral: true });

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

| Contexto | Sintaxis correcta |
|---|---|
| Slash command reply directo | `interaction.reply({ ..., ephemeral: true })` |
| Event handler / followUp / editReply tras defer efímero | `flags: [MessageFlags.Ephemeral]` |

> El LSP puede marcar `flags: [MessageFlags.Ephemeral]` como error — ignorarlo, funciona en runtime.

## Reglas de DB

- **NUNCA** importar `prisma` directamente en commands o services
- Siempre ir a través de un repository en `src/config/repositories/`
- Si la feature necesita un modelo nuevo: schema → migrate → repository → usar en el subcomando

```typescript
// ✅ Correcto
import * as MiRepo from "../../../config/repositories/MiRepo";

// ❌ Incorrecto
import { prisma } from "../../../infrastructure/storage";
```

## Reglas de botones / modales / selects

Si el comando genera botones, modales o select menus:

1. Usar convención de `customId`: `<feature>_<accion>_<id_opcional>`
2. Registrar el handler en `src/app/events/interactionCreate.ts`

```typescript
// En interactionCreate.ts, dentro del bloque interaction.isButton():
if (interaction.customId.startsWith("mifeature_")) {
  await handleMiFeature(interaction);
  return;
}
```

## Reglas de logger

```typescript
import logger from "../../../utils/logger";

// NUNCA console.log — siempre logger
logger.info("Mensaje", { userId: interaction.user.id, guildId: interaction.guildId });
logger.error("Error", { error: error instanceof Error ? error.message : String(error) });
```

## Checklist antes de terminar

- [ ] Carpeta `src/app/commands/<nombre>/` creada con `index.ts`
- [ ] Exports nombrados `data` y `execute` en `index.ts`
- [ ] Un archivo por subcomando
- [ ] `deferReply` antes de cualquier operación async
- [ ] Usar logger, nunca `console.log`
- [ ] Si tiene DB: repository creado en `src/config/repositories/`
- [ ] Si tiene botones/modales: handler registrado en `interactionCreate.ts`
- [ ] Permisos definidos en `SlashCommandBuilder` si aplica

## Resources

- **Referencia de proyecto**: [agents.md](../../agents.md)
- **Ejemplo real**: [src/app/commands/autorole/](../../src/app/commands/autorole/)
- **Template index.ts**: [assets/index-template.ts](assets/index-template.ts)
- **Template subcomando**: [assets/subcommand-template.ts](assets/subcommand-template.ts)
