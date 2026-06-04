import type { Client, Guild, GuildMember, User } from "discord.js";
import type { WarnThresholdAction } from "@charlybot/shared/schemas/moderation";

import { logModAction } from "./ModLogService.js";
import * as ModCaseRepository from "../../config/repositories/modCaseRepository.js";
import * as WarnThresholdRepository from "../../config/repositories/warnThresholdRepository.js";
import logger from "../../utils/logger.js";
export interface WarnThresholdContext {
  client: Client;
  guild: Guild;
  guildId: string;
  targetMember: GuildMember;
  targetUser: User;
  moderatorId: string;
  moderatorTag: string;
  userTag: string;
}

export interface WarnThresholdResult {
  matched: boolean;
  action?: WarnThresholdAction;
  ok?: boolean;
  caseFailed?: boolean;
  logFailed?: boolean;
  message?: string;
  error?: string;
}
export async function enforceWarnThreshold(
  context: WarnThresholdContext,
): Promise<WarnThresholdResult> {
  const activeWarnCount = await ModCaseRepository.countActiveWarns(
    context.guildId,
    context.targetUser.id,
  );
  const threshold = await WarnThresholdRepository.findByWarnCount(
    context.guildId,
    activeWarnCount,
  );

  if (!threshold) {
    return { matched: false };
  }

  const thresholdDuration = threshold.duration ?? undefined;
  const thresholdLabel = formatThresholdLabel(threshold.action, thresholdDuration);
  const thresholdReason = `Threshold automático por ${activeWarnCount} warns (${thresholdLabel})`;

  try {
    if (threshold.action === "timeout") {
      if (!thresholdDuration) {
        throw new Error("Timeout threshold sin duración configurada.");
      }
      await context.targetMember.timeout(Number(thresholdDuration), thresholdReason);
    }
    if (threshold.action === "kick") {
      await context.targetMember.kick(thresholdReason);
    }
    if (threshold.action === "ban") {
      await context.guild.bans.create(context.targetUser.id, { reason: thresholdReason });
    }

    let escalationCase;
    try {
      escalationCase = await ModCaseRepository.create({
        guildId: context.guildId,
        userId: context.targetUser.id,
        moderatorId: context.moderatorId,
        type: threshold.action,
        reason: thresholdReason,
        ...(thresholdDuration !== undefined ? { duration: thresholdDuration } : {}),
      });
    } catch (error) {
      const caseError = error instanceof Error ? error.message : String(error);
      logger.warn("Warn threshold case creation failed after successful escalation", {
        guildId: context.guildId,
        userId: context.targetUser.id,
        warnCount: activeWarnCount,
        action: threshold.action,
        thresholdId: threshold.id,
        error: caseError,
      });

      return {
        matched: true,
        action: threshold.action,
        ok: true,
        caseFailed: true,
        error: caseError,
        message: `Threshold aplicado: ${thresholdLabel}, pero falló la creación del caso de moderación: ${caseError}`,
      };
    }

    let logError: string | undefined;
    try {
      await logModAction(
        context.client,
        context.guildId,
        escalationCase,
        context.moderatorTag,
        context.userTag,
      );
    } catch (error) {
      logError = error instanceof Error ? error.message : String(error);
      logger.warn("Warn threshold log failed after successful escalation", {
        guildId: context.guildId,
        userId: context.targetUser.id,
        warnCount: activeWarnCount,
        action: threshold.action,
        thresholdId: threshold.id,
        caseNumber: escalationCase.caseNumber,
        error: logError,
      });
    }

    logger.info("Warn threshold applied", {
      guildId: context.guildId,
      userId: context.targetUser.id,
      warnCount: activeWarnCount,
      action: threshold.action,
      thresholdId: threshold.id,
      caseNumber: escalationCase.caseNumber,
    });

    return {
      matched: true,
      action: threshold.action,
      ok: true,
      ...(logError !== undefined ? { logFailed: true } : {}),
      ...(logError !== undefined ? { error: logError } : {}),
      message: logError !== undefined
        ? `Threshold aplicado: ${thresholdLabel}, pero falló el registro en el canal de moderación: ${logError}`
        : `Threshold aplicado: ${thresholdLabel}.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn("Warn threshold escalation failed", {
      guildId: context.guildId,
      userId: context.targetUser.id,
      warnCount: activeWarnCount,
      action: threshold.action,
      thresholdId: threshold.id,
      error: errorMessage,
    });

    return {
      matched: true,
      action: threshold.action,
      ok: false,
      error: errorMessage,
      message: `la escalada automática (${thresholdLabel}) falló: ${errorMessage}`,
    };
  }
}

function formatThresholdLabel(action: WarnThresholdAction, duration?: bigint): string {
  if (action !== "timeout") {
    return action;
  }
  if (!duration) {
    return "timeout";
  }
  return `timeout por ${formatDuration(duration)}`;
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
