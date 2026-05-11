import { prisma } from "@charlybot/shared";
import type { IModCase } from "@charlybot/shared";
import logger from "../../utils/logger";

export interface CreateModCaseData {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: IModCase["type"];
  reason?: string;
  duration?: bigint;
  messageCount?: number;
}

/**
 * Crea un nuevo caso de moderación.
 * Calcula caseNumber automáticamente como countByGuild(guildId) + 1.
 */
export async function create(data: CreateModCaseData): Promise<IModCase> {
  const count = await prisma.modCase.count({
    where: { guildId: data.guildId },
  });

  const created = await prisma.modCase.create({
    data: {
      guildId: data.guildId,
      userId: data.userId,
      moderatorId: data.moderatorId,
      caseNumber: count + 1,
      type: data.type,
      reason: data.reason ?? null,
      duration: data.duration ?? null,
      messageCount: data.messageCount ?? null,
      active: true,
    },
  });

  logger.info(`ModCase #${created.caseNumber} created`, {
    guildId: created.guildId,
    userId: created.userId,
    type: created.type,
  });

  return toDomain(created);
}

/**
 * Busca un caso por su ID.
 */
export async function findById(id: number): Promise<IModCase | null> {
  const modCase = await prisma.modCase.findUnique({
    where: { id },
  });

  if (!modCase) return null;
  return toDomain(modCase);
}

/**
 * Lista todos los casos de un usuario en un guild.
 */
export async function findByUser(
  guildId: string,
  userId: string,
): Promise<IModCase[]> {
  const cases = await prisma.modCase.findMany({
    where: { guildId, userId },
    orderBy: { caseNumber: "asc" },
  });

  return cases.map(toDomain);
}

/**
 * Lista todos los casos de un guild.
 */
export async function findByGuild(guildId: string): Promise<IModCase[]> {
  const cases = await prisma.modCase.findMany({
    where: { guildId },
    orderBy: { caseNumber: "asc" },
  });

  return cases.map(toDomain);
}

/**
 * Cuenta warns activos (type="warn", active=true) para un usuario en un guild.
 */
export async function countActiveWarns(
  guildId: string,
  userId: string,
): Promise<number> {
  return prisma.modCase.count({
    where: {
      guildId,
      userId,
      type: "warn",
      active: true,
    },
  });
}

/**
 * Desactiva un caso (active=false). Usado para unban o timeout expirado.
 */
export async function deactivate(id: number): Promise<IModCase | null> {
  const updated = await prisma.modCase.update({
    where: { id },
    data: { active: false },
  });

  logger.info(`ModCase #${updated.caseNumber} deactivated`, {
    id: updated.id,
    guildId: updated.guildId,
  });

  return toDomain(updated);
}

/**
 * Actualiza la razón de un caso.
 */
export async function updateReason(
  id: number,
  reason: string,
): Promise<IModCase | null> {
  const updated = await prisma.modCase.update({
    where: { id },
    data: { reason },
  });

  logger.info(`ModCase #${updated.caseNumber} reason updated`, {
    id: updated.id,
  });

  return toDomain(updated);
}

// --- Internal mapper ---

function toDomain(record: {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  caseNumber: number;
  type: string;
  reason: string | null;
  duration: bigint | null;
  active: boolean;
  messageCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}): IModCase {
  return {
    id: record.id,
    guildId: record.guildId,
    userId: record.userId,
    moderatorId: record.moderatorId,
    caseNumber: record.caseNumber,
    type: record.type as IModCase["type"],
    reason: record.reason ?? undefined,
    duration: record.duration ?? undefined,
    active: record.active,
    messageCount: record.messageCount ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
