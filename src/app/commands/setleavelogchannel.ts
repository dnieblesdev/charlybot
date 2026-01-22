import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setLeaveLogChannel } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("set-leave-log-channel")
  .setDescription(
    "Configura el canal donde se enviarán logs cuando alguien salga del servidor",
  )
  .addChannelOption((option) =>
    option
      .setName("canal")
      .setDescription("Canal de logs de salida")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "set-leave-log-channel",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.getChannel("canal", true);

    await setLeaveLogChannel(interaction.guild.id, channel.id);

    logger.info("Leave log channel configured", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: channel.id,
    });

    await interaction.reply({
      content: `✅ Canal de logs de salida configurado: <#${channel.id}>.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error executing set-leave-log-channel command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Error configurando canal de logs de salida.",
        ephemeral: true,
      });
    }
  }
}
