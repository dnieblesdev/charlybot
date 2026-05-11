import { prisma } from "@charlybot/shared";
import type { IWarnThreshold, WarnThresholdAction } from "@charlybot/shared";
import logger from "../../utils/logger";

/**
 * Crea un nuevo threshold de warns para un guild.
 */
export async function create(
  guildId: string,
  warnCount: number,
  action: WarnThresholdAction,
  duration?: bigint,
): Promise<IWarnThreshold> {
  const created = await prisma.warnThreshold.create({
    data: {
      guildId,
      warnCount,
      action,
      duration: duration ?? null,
    },
  });

  logger.info(`WarnThreshold created: ${warnCount} warns → ${action}`, {
    guildId,
    id: created.id,
  });

  return toDomain(created);
}

/**
 * Lista todos los thresholds de un guild, ordenados por warnCount ASC.
 */
export async function findAll(guildId: string): Promise<IWarnThreshold[]> {
  const thresholds = await prisma.warnThreshold.findMany({
    where: { guildId },
    orderBy: { warnCount: "asc" },
  });

  return thresholds.map(toDomain);
}

/**
 * Busca un threshold específico por warnCount en un guild.
 */
export async function findByWarnCount(
  guildId: string,
  warnCount: number,
): Promise<IWarnThreshold | null> {
  const threshold = await prisma.warnThreshold.findUnique({
    where: {
      guildId_warnCount: { guildId, warnCount },
    },
  });

  if (!threshold) return null;
  return toDomain(threshold);
}

/**
 * Elimina un threshold por su ID.
 */
export async function deleteById(id: number): Promise<void> {
  await prisma.warnThreshold.delete({ where: { id } });

  logger.info(`WarnThreshold deleted`, { id });
}

/**
 * Actualiza un threshold existente.
 */
export async function update(
  id: number,
  data: {
    warnCount?: number;
    action?: WarnThresholdAction;
    duration?: bigint | null;
  },
): Promise<IWarnThreshold | null> {
  const updated = await prisma.warnThreshold.update({
    where: { id },
    data: {
      ...(data.warnCount !== undefined && { warnCount: data.warnCount }),
      ...(data.action !== undefined && { action: data.action }),
      ...(data.duration !== undefined && { duration: data.duration }),
    },
  });

  logger.info(`WarnThreshold updated`, { id });

  return toDomain(updated);
}

// --- Internal mapper ---

function toDomain(record: {
  id: number;
  guildId: string;
  warnCount: number;
  action: string;
  duration: bigint | null;
}): IWarnThreshold {
  return {
    id: record.id,
    guildId: record.guildId,
    warnCount: record.warnCount,
    action: record.action as WarnThresholdAction,
    duration: record.duration ?? undefined,
  };
}
