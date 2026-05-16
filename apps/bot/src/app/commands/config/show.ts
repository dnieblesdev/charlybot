import {
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getGuildConfig } from "../../../config/repositories/GuildConfigRepo.ts";
import { listSocialLinks } from "../../../config/repositories/SocialLinkRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

/** Trunca un mensaje para que quepa en un campo de embed (máx 1024 chars). */
function truncate(value: string, max = 200): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 3) + "...";
}

/** Renderiza una lista de pares [label, valor] como bullets con flecha. */
function drawList(rows: [string, string][]): string {
  return rows.map(([label, val]) => `• **${label}** → ${val}`).join("\n");
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

    // Leer publico ANTES de deferReply para controlar si la respuesta es ephemeral
    const isPublic = interaction.options.getBoolean("publico") ?? false;

    await interaction.deferReply({
      flags: isPublic ? undefined : [MessageFlags.Ephemeral],
    });

    const config = await getGuildConfig(interaction.guild.id);

    if (!config) {
      await interaction.editReply({
        content:
          "❌ No hay configuración establecida. Usa `/set-image-channel` o `/set-voice-log` para configurar.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("⚙️ Configuración del Servidor")
      .setFooter({
        text: isPublic
          ? `Mostrado por ${interaction.user.username}`
          : `Solo visible para ${interaction.user.username}`,
      })
      .setTimestamp();

    // ── 📡 Canales ──
    const canales: [string, string][] = [];
    if (config.welcomeChannelId && !config.welcomeMessage) {
      canales.push(["Bienvenida", `<#${config.welcomeChannelId}>`]);
    }
    if (config.leaveLogChannelId) {
      canales.push(["Salidas", `<#${config.leaveLogChannelId}>`]);
    }
    if (config.targetChannelId) {
      canales.push(["Imágenes", `<#${config.targetChannelId}>`]);
    }
    if (config.voiceLogChannelId) {
      canales.push(["Voz", `<#${config.voiceLogChannelId}>`]);
    }
    if (config.messageLogChannelId) {
      canales.push(["Mensajes", `<#${config.messageLogChannelId}>`]);
    }
    if (canales.length > 0) {
      embed.addFields({ name: "📡 Canales", value: drawList(canales), inline: false });
    }

    // ── 💬 Bienvenida ──
    if (config.welcomeMessage) {
      const bienvenida: [string, string][] = [];
      if (config.welcomeChannelId) {
        bienvenida.push(["Canal", `<#${config.welcomeChannelId}>`]);
      }
      bienvenida.push(["Mensaje", truncate(config.welcomeMessage)]);
      embed.addFields({ name: "💬 Bienvenida", value: drawList(bienvenida), inline: false });
    }

    // ── ✅ Verificación ──
    const verificacion: [string, string][] = [];
    if (config.verificationChannelId) {
      verificacion.push(["Canal", `<#${config.verificationChannelId}>`]);
    }
    if (config.verificationReviewChannelId) {
      verificacion.push(["Revisión", `<#${config.verificationReviewChannelId}>`]);
    }
    if (config.verifiedRoleId) {
      verificacion.push(["Rol", `<@&${config.verifiedRoleId}>`]);
    }
    if (verificacion.length > 0) {
      embed.addFields({ name: "✅ Verificación", value: drawList(verificacion), inline: false });
    }

    // ── 🛡️ Moderación ──
    const moderacion: [string, string][] = [];
    if (config.modRoleId) {
      moderacion.push(["Rol", `<@&${config.modRoleId}>`]);
    }
    if (config.modLogChannelId) {
      moderacion.push(["Logs", `<#${config.modLogChannelId}>`]);
    }
    moderacion.push(["Anti-spam", config.antispamEnabled ? "✅ Activado" : "❌ Desactivado"]);
    embed.addFields({ name: "🛡️ Moderación", value: drawList(moderacion), inline: false });

    // ── 🔗 Redes ──
    const socialLinks = await listSocialLinks(interaction.guild.id);
    if (socialLinks.size > 0) {
      const redes: [string, string][] = [];
      for (const [platform, url] of socialLinks) {
        redes.push([platform.charAt(0).toUpperCase() + platform.slice(1), url]);
      }
      embed.addFields({ name: "🔗 Redes", value: drawList(redes), inline: false });
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
