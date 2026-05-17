import {
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import { listWelcomeCustomVars } from "../../../../config/repositories/WelcomeCustomVarRepo.ts";
import { logCommand } from "../../../../utils/logger.ts";

const MAX_MESSAGE_LENGTH = 2000;
const DISCRIMINATOR = " → ";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "welcome var list",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const customVars = await listWelcomeCustomVars(interaction.guild.id);

    if (customVars.size === 0) {
      await interaction.editReply({
        content: "📋 No hay variables personalizadas configuradas.",
      });
      return;
    }

    // Build bullet list
    const lines: string[] = [];
    for (const [name, value] of customVars) {
      lines.push(`• \`{${name}}\`${DISCRIMINATOR}${value}`);
    }

    let content = lines.join("\n");

    // Truncate if exceeds Discord limit
    if (content.length > MAX_MESSAGE_LENGTH) {
      const truncatedLines: string[] = [];
      let currentLength = 0;

      for (const line of lines) {
        if (currentLength + line.length + 1 > MAX_MESSAGE_LENGTH - 50) {
          // Leave room for truncation message
          break;
        }
        truncatedLines.push(line);
        currentLength += line.length + 1;
      }

      content =
        truncatedLines.join("\n") +
        `\n\n... y ${customVars.size - truncatedLines.length} variable(s) más.`;
    }

    await interaction.editReply({ content });
  } catch (error) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "❌ Error al listar las variables de bienvenida.",
      });
    } else {
      await interaction.reply({
        content: "❌ Error al listar las variables de bienvenida.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}