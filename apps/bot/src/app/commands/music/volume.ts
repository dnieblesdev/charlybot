import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "volume");

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

    const volume = interaction.options.getInteger("level", true);

    const success = musicService.setVolume(interaction.guildId, volume);

    if (success) {
      const volumeIcon =
        volume === 0 ? "🔇" : volume < 50 ? "🔈" : volume < 100 ? "🔉" : "🔊";

      await interaction.editReply({
        content: `${volumeIcon} Volumen ajustado a **${volume}%**`,
      });

      logger.info("Volume command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        volume,
      });
    } else {
      await interaction.editReply({
        content: "❌ No se pudo ajustar el volumen.",
      });
    }
  } catch (error) {
    logger.error("Error executing volume command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Error al ajustar el volumen." });
    } else {
      await interaction.reply({ content: "❌ Error al ajustar el volumen." });
    }
  }
}