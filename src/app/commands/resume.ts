import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("resume")
  .setDescription("Reanuda la reproducción pausada");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "resume");

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
        content: "❌ No hay música en la cola.",
        ephemeral: true,
      });
      return;
    }

    if (!queue.isPaused) {
      await interaction.reply({
        content: "▶️ La música no está pausada.",
        ephemeral: true,
      });
      return;
    }

    const resumed = musicService.resume(interaction.guildId);

    if (resumed) {
      await interaction.reply({
        content: "▶️ Reproducción reanudada.",
      });

      logger.info("Resume command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo reanudar la reproducción.",
        ephemeral: true,
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
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
