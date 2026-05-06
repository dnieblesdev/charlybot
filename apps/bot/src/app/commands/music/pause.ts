import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "pause");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.editReply({
        content: "❌ No hay música reproduciéndose.",
      });
      return;
    }

    if (queue.isPaused) {
      await interaction.editReply({
        content: "⏸️ La música ya está pausada.",
      });
      return;
    }

    if (!queue.isPlaying) {
      await interaction.editReply({
        content: "❌ No hay música reproduciéndose.",
      });
      return;
    }

    const paused = musicService.pause(interaction.guildId);

    if (paused) {
      await interaction.editReply({
        content: "⏸️ Música pausada.",
      });

      logger.info("Pause command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.editReply({
        content: "❌ No se pudo pausar la música.",
      });
    }
  } catch (error) {
    logger.error("Error executing pause command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al pausar la música.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage });
    }
  }
}