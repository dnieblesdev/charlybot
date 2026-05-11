import type { ChatInputCommandInteraction } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import { DurationSchema } from "@charlybot/shared/schemas/moderation";
import type { WarnThresholdAction } from "@charlybot/shared/schemas/moderation";
import * as WarnThresholdRepository from "../../../../config/repositories/warnThresholdRepository.js";
import logger from "../../../../utils/logger.js";

export default async function warnThreshold(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Require Administrator for config changes
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "❌ Solo los **administradores** pueden configurar thresholds de warns.",
      });
      return;
    }

    const warns = interaction.options.getInteger("warns", true);
    const accion = interaction.options.getString("accion", true) as WarnThresholdAction;
    const duracion = interaction.options.getString("duracion");

    // Parse duration if action is timeout
    let durationMs: bigint | undefined;
    let durationStr: string | undefined;
    if (accion === "timeout") {
      if (!duracion) {
        await interaction.editReply({
          content: "❌ Para la acción **timeout** debés especificar una duración (ej: 1h, 30m, 1d).",
        });
        return;
      }

      try {
        durationMs = DurationSchema.parse(duracion);
        durationStr = formatDuration(durationMs);
      } catch {
        await interaction.editReply({
          content: "❌ Formato de duración inválido. Usá: 10m, 1h, 2d",
        });
        return;
      }
    }

    await WarnThresholdRepository.create(interaction.guildId, warns, accion, durationMs);

    const durationNote = durationStr ? ` por ${durationStr}` : "";
    await interaction.editReply({
      content: `✅ ${warns} warns → ${accion}${durationNote}`,
    });
  } catch (error) {
    logger.error("Error executing /mod config warn-threshold", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al configurar el threshold. Inténtalo de nuevo.",
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
