import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pausa la reproducción actual");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "pause");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.reply({
        content: "❌ No hay música reproduciéndose.",
        ephemeral: true,
      });
      return;
    }

    if (queue.isPaused) {
      await interaction.reply({
        content: "⏸️ La música ya está pausada.",
        ephemeral: true,
      });
      return;
    }

    if (!queue.isPlaying) {
      await interaction.reply({
        content: "❌ No hay música reproduciéndose.",
        ephemeral: true,
      });
      return;
    }

    const paused = musicService.pause(interaction.guildId);

    if (paused) {
      await interaction.reply({
        content: "⏸️ Música pausada.",
      });

      logger.info("Pause command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo pausar la música.",
        ephemeral: true,
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
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
