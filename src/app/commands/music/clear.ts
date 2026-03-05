import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "clear");

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
        content: "❌ No hay música en la cola.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (queue.songs.length === 0) {
      await interaction.reply({
        content: "❌ La cola ya está vacía.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const count = musicService.clearSongs(interaction.guildId);

    await interaction.reply({
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

    const errorMessage = "❌ Error al limpiar la cola.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
