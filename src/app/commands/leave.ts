import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("Hace que el bot salga del canal de voz");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "leave");

    // Verificar que el comando se ejecute en un servidor
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
      return;
    }

    // Verificar si el bot está en un canal de voz
    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.reply({
        content: "❌ No estoy en ningún canal de voz.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const channelName = queue.voiceChannel.name;

    // Salir del canal de voz
    await musicService.leave(interaction.guildId);

    await interaction.editReply({
      content: `👋 Salí de **${channelName}**`,
    });

    logger.info("Leave command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelName,
    });
  } catch (error) {
    logger.error("Error executing leave command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al intentar salir del canal de voz.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
