import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setVoiceLogChannel } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("set-voice-log")
  .setDescription(
    "Configura el canal para registrar entrada/salida de canales de voz",
  )
  .addChannelOption((option) =>
    option
      .setName("canal")
      .setDescription("El canal donde se registrarán los logs de voz")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "set-voice-log",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.options.getChannel("canal", true);

    await setVoiceLogChannel(interaction.guild.id, channel.id);

    logger.info("Voice log channel configured successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: channel.id,
    });

    await interaction.reply({
      content: `✅ Canal de logs de voz configurado: Los mensajes se enviarán a <#${channel.id}>`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("Error executing set-voice-log command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al configurar el canal de logs de voz.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
