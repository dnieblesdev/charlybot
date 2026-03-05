import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "skip");

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

    if (!queue.isPlaying) {
      await interaction.reply({
        content: "❌ No hay música reproduciéndose actualmente.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const skipped = await musicService.skip(interaction.guildId);

    if (skipped) {
      await interaction.reply({
        content: "⏭️ Canción saltada.",
      });

      logger.info("Skip command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo saltar la canción.",
        flags: [MessageFlags.Ephemeral],
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
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
