import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import * as AutoRoleRepo from "../../../config/repositories/AutoRoleRepo.js";

import { openExistingAutoRoleEditor } from "./setup";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "autorole-edit",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const messageId = interaction.options.getString("message_id", true);

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // Buscar la configuración
    const autoRole = await AutoRoleRepo.getAutoRoleByMessageId(interaction.guild.id, messageId);

    if (!autoRole) {
      await interaction.editReply({
        content:
          "❌ Ese mensaje no tiene una configuración de auto-roles.\n\nUsa `/autorole setup message_id:" +
          messageId +
          "` para configurarlo.",
      });
      return;
    }

    // Verificar que pertenece al servidor actual
    if (autoRole.guildId !== interaction.guild.id) {
      await interaction.editReply({
        content: "❌ Ese mensaje no pertenece a este servidor.",
      });
      return;
    }

    // Verificar que el mensaje todavía existe y calcular si el bot puede editarlo
    // (el editor puede funcionar igual para reacciones, pero bloquea editar/personalizar embed)
    try {
      const channel = await interaction.guild.channels.fetch(
        autoRole.channelId,
      );
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({
          content:
            "❌ El canal del mensaje ya no existe o no es un canal de texto.\n\nPuedes eliminar esta configuración con `/autorole-remove`.",
        });
        return;
      }

      const message = await (channel as any).messages.fetch(autoRole.messageId);
      if (!message) {
        await interaction.editReply({
          content:
            "❌ El mensaje ya no existe.\n\nPuedes eliminar esta configuración con `/autorole-remove`.",
        });
        return;
      }

      const botMember = await interaction.guild.members.fetchMe();
      const messageAuthorIsBot = message.author.id === botMember.user.id;
      const canEditMessage = messageAuthorIsBot;

      // Abrir UI de edición (misma que setup) para esta config existente
      await openExistingAutoRoleEditor(interaction, autoRole as any, {
        targetChannelId: autoRole.channelId,
        uiChannelId: interaction.channelId,
        messageAuthorIsBot,
        canEditMessage,
      });

      logger.info("AutoRole edit UI opened", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        messageId,
        autoRoleId: autoRole.id,
        canEditMessage,
      });

      return;
    } catch (error) {
      await interaction.editReply({
        content:
          "❌ No pude acceder al mensaje.\n\nVerifica que el bot tenga permisos en ese canal o usa `/autorole-remove` para eliminar esta configuración.",
      });
      return;
    }
  } catch (error) {
    logger.error("Error executing autorole-edit command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al acceder a la configuración de auto-roles. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
