import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "clear");

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

    if (queue.songs.length === 0) {
      await interaction.editReply({
        content: "❌ La cola ya está vacía.",
      });
      return;
    }

    const count = await musicService.clearSongs(interaction.guildId);

    await interaction.editReply({
      content: `🗑️ Se limpiaron **${count}** canción(es) de la cola.`,
    });

    logger.info("Clear command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      clearedCount: count,
    });
  } catch (error) {
    logger.error("Error executing clear command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Error al limpiar la cola." });
    } else {
      await interaction.reply({ content: "❌ Error al limpiar la cola." });
    }
  }
}