import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("shuffle")
  .setDescription("Mezcla aleatoriamente la cola de reproducción");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "shuffle");

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

    if (queue.songs.length < 2) {
      await interaction.reply({
        content: "❌ No hay suficientes canciones en la cola para mezclar.",
        ephemeral: true,
      });
      return;
    }

    const shuffled = musicService.shuffle(interaction.guildId);

    if (shuffled) {
      await interaction.reply({
        content: `🔀 Se mezclaron **${queue.songs.length}** canciones en la cola.`,
      });

      logger.info("Shuffle command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        songCount: queue.songs.length,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo mezclar la cola.",
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error("Error executing shuffle command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al mezclar la cola.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
