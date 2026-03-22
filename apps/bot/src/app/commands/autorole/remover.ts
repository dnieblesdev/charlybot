import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  MessageFlags,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import * as AutoRoleRepo from "../../../config/repositories/AutoRoleRepo.js";
import { CUSTOM_IDS } from "../../interactions/customIds.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "autorole-remove",
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

    // Obtener información del canal y roles
    let channelInfo = `<#${autoRole.channelId}>`;
    try {
      const channel = await interaction.guild.channels.fetch(
        autoRole.channelId,
      );
      if (!channel) {
        channelInfo = `Canal desconocido (${autoRole.channelId})`;
      }
    } catch {
      channelInfo = `Canal desconocido (${autoRole.channelId})`;
    }

    let rolesInfo = "";
    for (const mapping of autoRole.mappings.slice(0, 5)) {
      try {
        const role = await interaction.guild.roles.fetch(mapping.roleId);
        const identifier =
          mapping.type === "reaction"
            ? mapping.emoji || "❓"
            : `🔘 ${mapping.buttonLabel || "Sin nombre"}`;
        rolesInfo += `${identifier} → ${role?.name || "Rol desconocido"}\n`;
      } catch {
        rolesInfo += `❓ → Rol desconocido\n`;
      }
    }

    if (autoRole.mappings.length > 5) {
      rolesInfo += `...y ${autoRole.mappings.length - 5} más`;
    }

    // Mensaje de confirmación
    const confirmMessage =
      `⚠️ **¿Estás seguro de que deseas eliminar esta configuración?**\n\n` +
      `**Título:** ${autoRole.embedTitle || "Sin título"}\n` +
      `**Canal:** ${channelInfo}\n` +
      `**Roles configurados:** ${autoRole.mappings.length}\n` +
      `${rolesInfo}\n\n` +
      `**Message ID:** \`${autoRole.messageId}\`\n\n` +
      `⚠️ **Nota:** El mensaje en Discord NO será eliminado, solo la configuración de auto-roles.`;

    // Botones de confirmación
    const confirmButton = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.CONFIRM_REMOVE)
      .setLabel("✅ Sí, eliminar")
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.CANCEL_REMOVE)
      .setLabel("❌ Cancelar")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      confirmButton,
      cancelButton,
    );

    const response = await interaction.editReply({
      content: confirmMessage,
      components: [row],
    });

    // Collector para la confirmación
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        componentType: ComponentType.Button,
        time: 60000, // 1 minuto
      });

      if (confirmation.customId === CUSTOM_IDS.autorole.config.CONFIRM_REMOVE) {
        // Eliminar la configuración
        await AutoRoleRepo.deleteAutoRoleByMessageId(interaction.guild.id, messageId);

        await confirmation.update({
          content: `✅ **Configuración eliminada exitosamente.**\n\nEl mensaje sigue visible en ${channelInfo}, pero ya no asignará roles automáticamente.`,
          components: [],
        });

        logger.info("AutoRole configuration removed", {
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          messageId,
          autoRoleId: autoRole.id,
        });
      } else {
        await confirmation.update({
          content:
            "❌ Eliminación cancelada. La configuración se mantiene activa.",
          components: [],
        });
      }
    } catch (error) {
      // Timeout o error
      await interaction.editReply({
        content: "⏱️ Tiempo de espera agotado. Eliminación cancelada.",
        components: [],
      });
    }
  } catch (error) {
    logger.error("Error executing autorole-remove command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al eliminar la configuración de auto-roles. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage, components: [] });
    } else {
      await interaction.reply({ content: errorMessage, components: [], flags: [MessageFlags.Ephemeral] });
    }
  }
}
