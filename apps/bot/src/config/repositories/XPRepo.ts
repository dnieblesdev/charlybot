import { prisma } from "@charlybot/shared";
import type { XPLeaderboard } from "../../domain/ports/IXPRepository";
import logger from "../../utils/logger";
import type { IUserXP, IXPConfig, ILevelRole } from "@charlybot/shared";

export async function getUserXP(
  guildId: string,
  userId: string,
): Promise<IUserXP | null> {
  try {
    return await prisma.userXP.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
  } catch (error) {
    logger.error(`Error getting user XP: ${userId} in ${guildId}`, { error });
    return null;
  }
}

export async function upsertUserXP(
  guildId: string,
  userId: string,
  data: Partial<IUserXP>,
): Promise<IUserXP> {
  return await prisma.userXP.upsert({
    where: { userId_guildId: { userId, guildId } },
    update: data,
    create: { guildId, userId, ...data } as IUserXP,
  });
}

export async function incrementUserXP(
  guildId: string,
  userId: string,
  xpIncrement: number,
  nivel: number,
  username?: string,
): Promise<IUserXP> {
  return await prisma.userXP.upsert({
    where: { userId_guildId: { userId, guildId } },
    update: {
      xp: { increment: xpIncrement },
      nivel,
      username,
      lastMessageAt: new Date(),
    },
    create: {
      userId,
      guildId,
      username,
      xp: xpIncrement,
      nivel,
      lastMessageAt: new Date(),
    },
  });
}

export async function getXPConfig(
  guildId: string,
): Promise<IXPConfig | null> {
  try {
    return await prisma.xPConfig.findUnique({
      where: { guildId },
    });
  } catch (error) {
    logger.error(`Error getting XP config for ${guildId}`, { error });
    return null;
  }
}

export async function createXPConfig(
  guildId: string,
  data: IXPConfig,
): Promise<IXPConfig> {
  return await prisma.xPConfig.create({
    data: { ...data, guildId },
  });
}

export async function updateXPConfig(
  guildId: string,
  data: Partial<IXPConfig>,
): Promise<IXPConfig> {
  return await prisma.xPConfig.update({
    where: { guildId },
    data,
  });
}

export async function getLevelRoles(
  guildId: string,
): Promise<ILevelRole[]> {
  return await prisma.levelRole.findMany({
    where: { guildId },
    orderBy: { level: "asc" },
  });
}

export async function createLevelRole(
  guildId: string,
  level: number,
  roleId: string,
): Promise<ILevelRole> {
  return await prisma.levelRole.create({
    data: { guildId, level, roleId },
  });
}

export async function deleteLevelRole(
  guildId: string,
  level: number,
): Promise<void> {
  await prisma.levelRole.delete({
    where: { guildId_level: { guildId, level } },
  });
}

export async function getXPLeaderboard(
  guildId: string,
  limit: number = 10,
): Promise<XPLeaderboard[]> {
  const results = await prisma.userXP.findMany({
    where: { guildId },
    orderBy: [{ xp: "desc" }, { lastMessageAt: "asc" }],
    take: limit,
  });
  return results.map((r) => ({
    ...r,
    username: r.username ?? "",
  })) as unknown as XPLeaderboard[];
}