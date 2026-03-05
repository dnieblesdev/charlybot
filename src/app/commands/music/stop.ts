import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "stop");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.reply({
        content: "❌ No hay música reproduciéndose.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const stopped = musicService.stop(interaction.guildId);

    if (stopped) {
      await interaction.reply({
        content: "⏹️ Música detenida y cola limpiada.",
      });

      logger.info("Stop command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo detener la música.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  } catch (error) {
    logger.error("Error executing stop command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al detener la música.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
