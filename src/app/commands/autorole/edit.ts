import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import * as AutoRoleRepo from "../../../config/repositories/AutoRoleRepo.js";

export const data = new SlashCommandBuilder()
  .setName("autorole-edit")
  .setDescription("Edita una configuración de auto-roles existente")
  .addStringOption((option) =>
    option
      .setName("message_id")
      .setDescription("ID del mensaje configurado")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

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
        ephemeral: true,
      });
      return;
    }

    const messageId = interaction.options.getString("message_id", true);

    await interaction.deferReply({ ephemeral: true });

    // Buscar la configuración
    const autoRole = await AutoRoleRepo.getAutoRoleByMessageId(messageId);

    if (!autoRole) {
      await interaction.editReply({
        content:
          "❌ No encontré ninguna configuración de auto-roles para ese mensaje.\n\nUsa `/autorole-list` para ver las configuraciones activas.",
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

    // Verificar que el mensaje todavía existe
    try {
      const channel = await interaction.guild.channels.fetch(autoRole.channelId);
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
    } catch (error) {
      await interaction.editReply({
        content:
          "❌ No pude acceder al mensaje.\n\nVerifica que el bot tenga permisos en ese canal o usa `/autorole-remove` para eliminar esta configuración.",
      });
      return;
    }

    // Mensaje informativo
    await interaction.editReply({
      content:
        "⚠️ **Edición de configuraciones**\n\n" +
        "Para editar una configuración existente, tienes dos opciones:\n\n" +
        "**1. Eliminar y recrear:**\n" +
        "• Usa `/autorole-remove message_id:" +
        messageId +
        "`\n" +
        "• Luego usa `/autorole-setup message_id:" +
        messageId +
        "` para crear una nueva configuración\n\n" +
        "**2. Modificar manualmente:**\n" +
        "• Edita el mensaje directamente en Discord\n" +
        "• Usa este comando para actualizar solo los roles configurados (próximamente)\n\n" +
        "💡 **Tip:** La opción 1 es más rápida y te permite reconfigurar completamente los roles.",
    });

    logger.info("AutoRole edit command executed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      messageId,
      autoRoleId: autoRole.id,
    });
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
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
