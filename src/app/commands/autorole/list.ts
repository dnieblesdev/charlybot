import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import * as AutoRoleRepo from "../../../config/repositories/AutoRoleRepo.js";

export const data = new SlashCommandBuilder()
  .setName("autorole-list")
  .setDescription("Lista todas las configuraciones de auto-roles del servidor")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "autorole-list",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const autoRoles = await AutoRoleRepo.getAutoRolesByGuild(
      interaction.guild.id,
    );

    if (autoRoles.length === 0) {
      await interaction.editReply({
        content:
          "📋 No hay configuraciones de auto-roles en este servidor.\n\nUsa `/autorole-setup` para crear una.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Configuraciones de Auto-Roles")
      .setColor(0x5865f2)
      .setDescription(
        `Se encontraron **${autoRoles.length}** configuración(es) activa(s).`,
      )
      .setFooter({
        text: `Total: ${autoRoles.length} configuración(es)`,
      })
      .setTimestamp();

    for (let i = 0; i < Math.min(autoRoles.length, 10); i++) {
      const autoRole = autoRoles[i];
      if (!autoRole) continue;

      // Obtener información del canal
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

      // Construir información de roles
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
        rolesInfo += `...y ${autoRole.mappings.length - 5} más\n`;
      }

      // Link al mensaje
      const messageLink = `https://discord.com/channels/${autoRole.guildId}/${autoRole.channelId}/${autoRole.messageId}`;

      embed.addFields({
        name: `${i + 1}. ${autoRole.embedTitle || "Sin título"}`,
        value:
          `**Canal:** ${channelInfo}\n` +
          `**Modo:** ${autoRole.mode === "multiple" ? "Múltiples roles" : "Rol único"}\n` +
          `**Roles configurados:** ${autoRole.mappings.length}\n` +
          `${rolesInfo}\n` +
          `**Message ID:** \`${autoRole.messageId}\`\n` +
          `[Ver mensaje](${messageLink})`,
        inline: false,
      });
    }

    if (autoRoles.length > 10) {
      embed.addFields({
        name: "⚠️ Nota",
        value: `Solo se muestran las primeras 10 configuraciones. Total: ${autoRoles.length}`,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    logger.info("AutoRole list command executed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      count: autoRoles.length,
    });
  } catch (error) {
    logger.error("Error executing autorole-list command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al listar las configuraciones de auto-roles. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
