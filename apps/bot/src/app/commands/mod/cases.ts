import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { canModerate, MODERATION_ACTION } from "../../services/ModGuardService.js";
import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

const TYPE_COLORS: Record<string, number> = {
  warn: 0xffcc00,
  ban: 0xff0000,
  kick: 0xff8800,
  timeout: 0x3498db,
  clear: 0x2ecc71,
  unban: 0x9b59b6,
};

export default async function cases(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const targetUser = interaction.options.getUser("usuario");
    const caseId = interaction.options.getInteger("id");

    const modCheck = await canModerate(interaction, MODERATION_ACTION.CASES);
    if (!modCheck.allowed) {
      await interaction.editReply({ content: `❌ ${modCheck.reason}` });
      return;
    }

    // Mode 1: Specific case by ID
    if (caseId !== null) {
      const modCase = await ModCaseRepository.findByGuildAndCaseNumber(interaction.guildId, caseId);
      if (!modCase) {
        await interaction.editReply({
          content: `❌ No se encontró el caso #${caseId} en este servidor.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Case #${modCase.caseNumber}`)
        .setColor(TYPE_COLORS[modCase.type] ?? 0x95a5a6)
        .addFields(
          { name: "Moderador", value: `<@${modCase.moderatorId}>`, inline: true },
          { name: "Usuario", value: `<@${modCase.userId}>`, inline: true },
          { name: "Tipo", value: modCase.type.toUpperCase(), inline: true },
          { name: "Razón", value: modCase.reason ?? "Sin razón especificada" },
          { name: "Fecha", value: modCase.createdAt?.toLocaleString("es-AR") ?? "N/A", inline: true },
          { name: "Estado", value: modCase.active ? "✅ Activo" : "❌ Inactivo", inline: true },
        )
        .setTimestamp(modCase.createdAt ?? new Date());

      if (modCase.duration) {
        const ms = Number(modCase.duration);
        const parts: string[] = [];
        const days = Math.floor(ms / 86_400_000);
        if (days > 0) parts.push(`${days}d`);
        const hours = Math.floor((ms % 86_400_000) / 3_600_000);
        if (hours > 0) parts.push(`${hours}h`);
        const minutes = Math.floor((ms % 3_600_000) / 60_000);
        if (minutes > 0) parts.push(`${minutes}m`);
        embed.addFields({ name: "Duración", value: parts.join(" ") || "< 1m", inline: true });
      }

      if (modCase.messageCount !== undefined) {
        embed.addFields({ name: "Mensajes eliminados", value: String(modCase.messageCount), inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Mode 2: Cases for specific user
    if (targetUser) {
      const cases = await ModCaseRepository.findByUser(interaction.guildId, targetUser.id);

      if (cases.length === 0) {
        await interaction.editReply({
          content: `📋 No hay casos registrados para @${targetUser.username}.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Casos de @${targetUser.username}`)
        .setColor(0x3498db)
        .setFooter({ text: "Usá /mod reason <id> para actualizar la razón" });

      for (const c of cases.slice(0, 10)) {
        const timeAgo = getTimeAgo(c.createdAt);
        embed.addFields({
          name: `Case #${c.caseNumber} — ${c.type.toUpperCase()} — <@${c.userId}>`,
          value: `${timeAgo} — ${c.reason ?? "Sin razón"}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Mode 3: Last 10 cases of the guild
    const allCases = await ModCaseRepository.findByGuild(interaction.guildId);
    const recentCases = allCases.slice(0, 10);

    if (recentCases.length === 0) {
      await interaction.editReply({
        content: "📋 No hay casos de moderación registrados en este servidor.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Historial de moderación")
      .setColor(0x3498db)
      .setFooter({ text: "Usá /mod reason <id> para actualizar la razón" });

    for (const c of recentCases) {
      const timeAgo = getTimeAgo(c.createdAt);
      embed.addFields({
        name: `Case #${c.caseNumber} — ${c.type.toUpperCase()} — <@${c.userId}>`,
        value: `${timeAgo} — ${c.reason ?? "Sin razón"}`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error executing /mod cases", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al consultar los casos. Inténtalo de nuevo.",
    });
  }
}

function getTimeAgo(date?: Date): string {
  if (!date) return "fecha desconocida";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "hace un momento";
  if (diffMins < 60) return `hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString("es-AR");
}
