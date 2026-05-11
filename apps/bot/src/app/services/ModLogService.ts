import type { Client } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo";
import type { IModCase } from "@charlybot/shared";
import logger from "../../utils/logger";

// Color map por tipo de acción
const ACTION_COLORS: Record<string, number> = {
  warn: 0xffcc00, // Yellow
  ban: 0xff0000, // Red
  kick: 0xff8800, // Orange
  timeout: 0x3498db, // Blue
  clear: 0x2ecc71, // Green
  unban: 0x9b59b6, // Purple
};

/**
 * Formatea una duración en ms a string legible (ej: "1h 30m").
 */
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

/**
 * Loggea una acción de moderación en el canal de mod log configurado.
 *
 * Si no hay canal configurado, loggea warning y retorna.
 * Si el canal no existe o no hay permisos, loggea warning sin crashear.
 */
export async function logModAction(
  client: Client,
  guildId: string,
  modCase: IModCase,
  moderatorTag: string,
  userTag: string,
): Promise<void> {
  const guildConfig = await getGuildConfig(guildId);
  const modLogChannelId = guildConfig?.modLogChannelId;

  if (!modLogChannelId) {
    logger.warn("ModLog channel not configured", { guildId });
    return;
  }

  const channel = await client.channels.fetch(modLogChannelId).catch(() => null);
  if (!channel || !("send" in channel)) {
    logger.warn("ModLog channel not found or invalid", {
      guildId,
      channelId: modLogChannelId,
    });
    return;
  }

  const color = ACTION_COLORS[modCase.type] ?? 0x95a5a6; // Default gray

  const embed = new EmbedBuilder()
    .setTitle(`[Case #${modCase.caseNumber}] ${modCase.type.toUpperCase()}`)
    .setColor(color)
    .addFields(
      { name: "Moderador", value: moderatorTag, inline: true },
      { name: "Usuario", value: userTag, inline: true },
    )
    .setFooter({ text: `ID: ${modCase.id}` })
    .setTimestamp(modCase.createdAt ?? new Date());

  // Razón (siempre presente)
  embed.addFields({
    name: "Razón",
    value: modCase.reason ?? "Sin razón especificada",
  });

  // Duración (si aplica)
  if (modCase.duration) {
    embed.addFields({
      name: "Duración",
      value: formatDuration(modCase.duration),
      inline: true,
    });
  }

  // Mensajes eliminados (si es clear)
  if (modCase.type === "clear" && modCase.messageCount !== undefined) {
    embed.addFields({
      name: "Mensajes eliminados",
      value: String(modCase.messageCount),
      inline: true,
    });
  }

  // Estado activo
  embed.addFields({
    name: "Estado",
    value: modCase.active ? "Activo" : "Inactivo",
    inline: true,
  });

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn("Failed to send mod log embed", {
      guildId,
      channelId: modLogChannelId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
