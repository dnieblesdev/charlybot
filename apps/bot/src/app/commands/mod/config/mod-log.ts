import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { ChannelType, MessageFlags, PermissionFlagsBits } from "discord.js";

import { update as updateGuildConfig } from "../../../../config/repositories/GuildConfigRepo.js";
import logger from "../../../../utils/logger.js";

export default async function modLog(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Require Administrator for config changes
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "❌ Solo los **administradores** pueden configurar el canal de registro.",
      });
      return;
    }

    const channel = interaction.options.getChannel("canal", true);

    if (channel.type !== ChannelType.GuildText) {
      await interaction.editReply({
        content: "❌ El canal debe ser un canal de texto.",
      });
      return;
    }

    // Check bot can send messages in the channel
    const textChannel = channel as TextChannel;
    const botMember = interaction.guild?.members.me;
    if (botMember) {
      const perms = textChannel.permissionsFor(botMember);
      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        await interaction.editReply({
          content: "❌ No tengo permisos para enviar mensajes en ese canal.",
        });
        return;
      }
    }

    await updateGuildConfig(interaction.guildId, { modLogChannelId: channel.id });

    // Send test message to the channel
    try {
      await textChannel.send("📋 Canal configurado para registro de moderación.");
    } catch {
      logger.warn("Failed to send test message to mod log channel", {
        channelId: channel.id,
        guildId: interaction.guildId,
      });
    }

    await interaction.editReply({
      content: `✅ Canal de registro configurado: <#${channel.id}>`,
    });
  } catch (error) {
    logger.error("Error executing /mod config mod-log", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al configurar el canal. Inténtalo de nuevo.",
    });
  }
}
