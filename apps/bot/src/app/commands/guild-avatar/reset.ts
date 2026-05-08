import { ChatInputCommandInteraction, MessageFlags, DiscordAPIError } from "discord.js";
import logger from "../../../utils/logger.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Este comando solo puede usarse en un servidor.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  // defer — editMe is an HTTP call that can exceed Discord's 3s timeout
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    await interaction.guild.members.editMe({ avatar: null });

    await interaction.editReply({
      content: "✅ Avatar del servidor eliminado.",
    });
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      if (error.code === 429) {
        await interaction.editReply({
          content: "⏳ Esperá unos minutos antes de cambiar el avatar de nuevo.",
        });
      } else if (error.code === 50013) {
        await interaction.editReply({
          content: "No tengo permiso para cambiar mi avatar en este servidor.",
        });
      } else {
        await interaction.editReply({
          content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
        });
        logger.error("Error resetting guild avatar", {
          error: error instanceof Error ? error.message : String(error),
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });
      }
    } else {
      await interaction.editReply({
        content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
      });
      logger.error("Error resetting guild avatar", {
        error: error instanceof Error ? error.message : String(error),
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });
    }
  }
}
