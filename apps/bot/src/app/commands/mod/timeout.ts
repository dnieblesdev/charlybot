import type { ChatInputCommandInteraction } from "discord.js";
import { DurationSchema } from "@charlybot/shared/schemas/moderation";

import {
  canModerate,
  canTargetModerator,
  canTargetSelf,
  canBotAct,
} from "../../services/ModGuardService.js";
import { logModAction } from "../../services/ModLogService.js";
import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

const MAX_TIMEOUT_MS = BigInt(2_419_200_000); // 28 days in ms

export default async function timeout(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const targetUser = interaction.options.getUser("usuario", true);
    const durationStr = interaction.options.getString("duracion", true);
    const reason = interaction.options.getString("razon") ?? "Sin razón especificada";

    // Parse duration
    let durationMs: bigint;
    try {
      durationMs = DurationSchema.parse(durationStr);
    } catch {
      await interaction.editReply({
        content: "❌ Formato de duración inválido. Usá: 10m, 1h, 2d",
      });
      return;
    }

    // Validate max 28 days
    if (durationMs > MAX_TIMEOUT_MS) {
      await interaction.editReply({
        content: "❌ El timeout no puede superar los 28 días.",
      });
      return;
    }

    const modMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    // Guard checks
    const modCheck = await canModerate(interaction);
    if (!modCheck.allowed) {
      await interaction.editReply({ content: `❌ ${modCheck.reason}` });
      return;
    }

    const selfCheck = canTargetSelf(interaction.user.id, targetUser.id);
    if (!selfCheck.allowed) {
      await interaction.editReply({ content: `❌ ${selfCheck.reason}` });
      return;
    }

    const hierarchyCheck = canTargetModerator(modMember, targetMember);
    if (!hierarchyCheck.allowed) {
      await interaction.editReply({ content: `❌ ${hierarchyCheck.reason}` });
      return;
    }

    const botMember = interaction.client.user
      ? await interaction.guild.members.fetch(interaction.client.user.id)
      : modMember;
    const botCheck = canBotAct(botMember, targetMember);
    if (!botCheck.allowed) {
      await interaction.editReply({ content: `❌ ${botCheck.reason}` });
      return;
    }

    // Apply timeout
    await targetMember.timeout(Number(durationMs), reason);

    // Create ModCase
    const modCase = await ModCaseRepository.create({
      guildId: interaction.guildId,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      type: "timeout",
      reason,
      duration: durationMs,
    });

    // Log action
    const modTag = modMember.user.username;
    const userTag = targetUser.username;
    await logModAction(interaction.client, interaction.guildId, modCase, modTag, userTag);

    // DM the user
    const durationLabel = formatDuration(durationMs);
    try {
      await targetUser.send(
        `Has sido silenciado por ${durationLabel} en ${interaction.guild.name}: ${reason}`,
      );
    } catch {
      logger.warn("Failed to send DM for timeout", {
        userId: targetUser.id,
        guildId: interaction.guildId,
      });
    }

    await interaction.editReply({
      content: `✅ ${userTag} silenciado por ${durationLabel}. Case #${modCase.caseNumber}`,
    });
  } catch (error) {
    logger.error("Error executing /mod timeout", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al ejecutar el timeout. Inténtalo de nuevo.",
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
