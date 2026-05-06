import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "resume");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.editReply({
        content: "❌ No hay música en la cola.",
      });
      return;
    }

    if (!queue.isPaused) {
      await interaction.editReply({
        content: "▶️ La música no está pausada.",
      });
      return;
    }

    const resumed = musicService.resume(interaction.guildId);

    if (resumed) {
      await interaction.editReply({
        content: "▶️ Reproducción reanudada.",
      });

      logger.info("Resume command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.editReply({
        content: "❌ No se pudo reanudar la reproducción.",
      });
    }
  } catch (error) {
    logger.error("Error executing resume command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al reanudar la reproducción.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage });
    }
  }
}