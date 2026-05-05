import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "pause");

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
        content: "❌ No hay música reproduciándose.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (queue.isPaused) {
      await interaction.reply({
        content: "⏸️ La música ya está pausada.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (!queue.isPlaying) {
      await interaction.reply({
        content: "❌ No hay música reproduciándose.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const paused = musicService.pause(interaction.guildId);

    await interaction.deferReply();

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
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
