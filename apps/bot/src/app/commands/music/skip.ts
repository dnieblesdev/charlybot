import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "skip");

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

    if (!queue.isPlaying) {
      await interaction.editReply({
        content: "❌ No hay música reproduciéndose actualmente.",
      });
      return;
    }

    const nowPlaying = await musicService.skip(interaction.guildId);

    if (nowPlaying) {
      await interaction.editReply({
        content: "⏭️ Canción saltada.\n🎵 **Reproduciendo ahora:** " + nowPlaying.title,
      });

      logger.info("Skip command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        nowPlaying: nowPlaying.title,
      });
    } else {
      await interaction.editReply({
        content: "❌ No se pudo saltar la canción.",
      });
    }
  } catch (error) {
    logger.error("Error executing skip command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al saltar la canción.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage });
    }
  }
}