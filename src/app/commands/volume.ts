import { SlashCommandBuilder } from "@discordjs/builders";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("volume")
  .setDescription("Ajusta el volumen de la reproducción")
  .addIntegerOption((option) =>
    option
      .setName("level")
      .setDescription("Nivel de volumen (0-200)")
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(200),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "volume");

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

    const volume = interaction.options.getInteger("level", true);

    const success = musicService.setVolume(interaction.guildId, volume);

    if (success) {
      const volumeIcon =
        volume === 0 ? "🔇" : volume < 50 ? "🔈" : volume < 100 ? "🔉" : "🔊";

      await interaction.reply({
        content: `${volumeIcon} Volumen ajustado a **${volume}%**`,
      });

      logger.info("Volume command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        volume,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo ajustar el volumen.",
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error("Error executing volume command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al ajustar el volumen.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
