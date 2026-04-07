import { MessageFlags, ChannelType } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setMessageLogChannel } from "../../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "set-message-log",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.options.getChannel("canal");

    if (channel) {
      await setMessageLogChannel(interaction.guild.id, channel.id);

      logger.info("Message log channel configured successfully", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        channelId: channel.id,
      });

      await interaction.reply({
        content: `✅ Canal de logs de mensajes configurado: Los mensajes editados/eliminados se enviarán a <#${channel.id}>`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // Clear the message log channel
      await setMessageLogChannel(interaction.guild.id, "");

      logger.info("Message log channel cleared", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      await interaction.reply({
        content: "✅ Canal de logs de mensajes eliminado.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Error executing set-message-log command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al configurar el canal de logs de mensajes.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}