import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "leave");

    // Verificar que el comando se ejecute en un servidor
    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Verificar si el bot está en un canal de voz
    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.editReply({
        content: "❌ No estoy en ningún canal de voz.",
      });
      return;
    }

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
      await interaction.reply({ content: errorMessage });
    }
  }
}