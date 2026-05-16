import {
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getGuildConfig } from "../../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

/** Trunca un mensaje para que quepa en un campo de embed (máx 1024 chars). */
function truncate(value: string, max = 200): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 3) + "...";
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "show-config");

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en servidores.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const config = await getGuildConfig(interaction.guild.id);

    if (!config) {
      await interaction.editReply({
        content:
          "❌ No hay configuración establecida. Usa `/set-image-channel` o `/set-voice-log` para configurar.",
      });
      return;
    }

    // Obtener la opción de mostrar públicamente
    const isPublic = interaction.options.getBoolean("publico") ?? false;

    // Crear un embed bonito
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("⚙️ Configuración del Servidor")
      .setFooter({
        text: isPublic
          ? `Mostrado por ${interaction.user.username}`
          : `Solo visible para ${interaction.user.username}`,
      })
      .setTimestamp();

    // ── Bienvenida ──
    if (config.welcomeChannelId) {
      const lines: string[] = [`📡 Canal: <#${config.welcomeChannelId}>`];
      if (config.welcomeMessage) {
        lines.push(`💬 Mensaje: ${truncate(config.welcomeMessage)}`);
      }
      embed.addFields({
        name: "👋 Bienvenida",
        value: lines.join("\n"),
        inline: false,
      });
    }

    // ── Logs de salida ──
    if (config.leaveLogChannelId) {
      embed.addFields({
        name: "🚪 Canal de Logs de Salida",
        value: `<#${config.leaveLogChannelId}>`,
        inline: false,
      });
    }

    // ── Imágenes ──
    if (config.targetChannelId) {
      embed.addFields({
        name: "📸 Canal de Imágenes",
        value: `<#${config.targetChannelId}>`,
        inline: false,
      });
    }

    // ── Voz ──
    if (config.voiceLogChannelId) {
      embed.addFields({
        name: "🎤 Canal de Logs de Voz",
        value: `<#${config.voiceLogChannelId}>`,
        inline: false,
      });
    }

    // ── Mensajes ──
    if (config.messageLogChannelId) {
      embed.addFields({
        name: "✏️ Canal de Logs de Mensajes",
        value: `<#${config.messageLogChannelId}>`,
        inline: false,
      });
    }

    // ── Verificación ──
    if (config.verificationChannelId || config.verificationReviewChannelId || config.verifiedRoleId) {
      const lines: string[] = [];
      if (config.verificationChannelId) lines.push(`📡 Canal: <#${config.verificationChannelId}>`);
      if (config.verificationReviewChannelId) lines.push(`📋 Revisión: <#${config.verificationReviewChannelId}>`);
      if (config.verifiedRoleId) lines.push(`🏅 Rol: <@&${config.verifiedRoleId}>`);
      embed.addFields({
        name: "✅ Verificación",
        value: lines.join("\n"),
        inline: false,
      });
    }

    // ── Moderación ──
    const modLines: string[] = [];
    if (config.modRoleId) modLines.push(`👮 Rol: <@&${config.modRoleId}>`);
    if (config.modLogChannelId) modLines.push(`📝 Logs: <#${config.modLogChannelId}>`);
    const antispamStatus = config.antispamEnabled ? "✅ Activado" : "❌ Desactivado";
    modLines.push(`🛡️ Anti-spam: ${antispamStatus}`);
    if (modLines.length > 0) {
      embed.addFields({
        name: "🛡️ Moderación",
        value: modLines.join("\n"),
        inline: false,
      });
    }

    logger.info("Show config command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      isPublic,
      hasImageChannel: !!config.targetChannelId,
      hasVoiceLogChannel: !!config.voiceLogChannelId,
      hasWelcomeChannel: !!config.welcomeChannelId,
      hasLeaveLog: !!config.leaveLogChannelId,
      hasVerification: !!config.verificationChannelId,
      hasModRole: !!config.modRoleId,
      antispamEnabled: config.antispamEnabled,
    });

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    logger.error("Error executing show-config command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al mostrar la configuración.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
