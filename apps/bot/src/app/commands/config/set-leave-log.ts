import {
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setLeaveLogChannel } from "../../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

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
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel("canal", true);

    await setLeaveLogChannel(interaction.guild.id, channel.id);

    logger.info("Leave log channel configured", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: channel.id,
    });

    await interaction.editReply({
      content: `✅ Canal de logs de salida configurado: <#${channel.id}>.`,
    });
  } catch (error) {
    logger.error("Error executing set-leave-log-channel command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    const errorMessage = "❌ Error configurando canal de logs de salida.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
