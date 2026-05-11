import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { canModerate } from "../../../services/ModGuardService.js";
import { getGuildConfig } from "../../../../config/repositories/GuildConfigRepo.js";
import * as WarnThresholdRepository from "../../../../config/repositories/warnThresholdRepository.js";
import logger from "../../../../utils/logger.js";

export default async function view(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Any mod can view config
    const modCheck = await canModerate(interaction);
    if (!modCheck.allowed) {
      await interaction.editReply({ content: `❌ ${modCheck.reason}` });
      return;
    }

    const config = await getGuildConfig(interaction.guildId);
    const thresholds = await WarnThresholdRepository.findAll(interaction.guildId);

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Configuración de moderación")
      .setColor(0x3498db);

    // Mod role
    if (config?.modRoleId) {
      embed.addFields({ name: "Rol de moderador", value: `<@&${config.modRoleId}>`, inline: true });
    } else {
      embed.addFields({ name: "Rol de moderador", value: "No configurado (requiere Administrador)", inline: true });
    }

    // Mod log channel
    if (config?.modLogChannelId) {
      embed.addFields({ name: "Canal de registro", value: `<#${config.modLogChannelId}>`, inline: true });
    } else {
      embed.addFields({ name: "Canal de registro", value: "No configurado", inline: true });
    }

    // Anti-spam
    const antispamStatus = config?.antispamEnabled ? "✅ Habilitado" : "❌ Deshabilitado";
    embed.addFields({ name: "Anti-spam", value: antispamStatus, inline: true });

    // Warn thresholds
    if (thresholds.length > 0) {
      const thresholdLines = thresholds.map((t) => {
        let line = `${t.warnCount} warns → ${t.action}`;
        if (t.duration) {
          line += ` (${formatDuration(t.duration)})`;
        }
        return line;
      });
      embed.addFields({ name: "Thresholds de warns", value: thresholdLines.join("\n") || "Ninguno configurado" });
    } else {
      embed.addFields({ name: "Thresholds de warns", value: "Ninguno configurado" });
    }

    embed.setFooter({ text: "Usá /mod config para modificar la configuración" });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error executing /mod config view", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al consultar la configuración. Inténtalo de nuevo.",
    });
  }
}

function formatDuration(ms: bigint): string {
  const totalMs = Number(ms);
  const parts: string[] = [];

  const days = Math.floor(totalMs / 86_400_000);
  if (days > 0) parts.push(`${days}d`);

  const hours = Math.floor((totalMs % 86_400_000) / 3_600_000);
  if (hours > 0) parts.push(`${hours}h`);

  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "< 1m";
}
