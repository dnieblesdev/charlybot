import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "shuffle");

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

    if (queue.songs.length < 2) {
      await interaction.editReply({
        content: "❌ No hay suficientes canciones en la cola para mezclar.",
      });
      return;
    }

    const shuffled = musicService.shuffle(interaction.guildId);

    if (shuffled) {
      await interaction.editReply({
        content: `🔀 Se mezclaron **${queue.songs.length}** canciones en la cola.`,
      });

      logger.info("Shuffle command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        songCount: queue.songs.length,
      });
    } else {
      await interaction.editReply({
        content: "❌ No se pudo mezclar la cola.",
      });
    }
  } catch (error) {
    logger.error("Error executing shuffle command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Error al mezclar la cola." });
    } else {
      await interaction.reply({ content: "❌ Error al mezclar la cola." });
    }
  }
}