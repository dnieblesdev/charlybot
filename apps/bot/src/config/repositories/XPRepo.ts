import { HttpXPAdapter } from "../../infrastructure/api/HttpXPAdapter";
import type { XPLeaderboard } from "../../domain/ports/IXPRepository";
import logger from "../../utils/logger";
import type { IUserXP, IXPConfig, ILevelRole } from "@charlybot/shared";

// Instancia del adaptador (Port implementation)
const xpRepo = new HttpXPAdapter();

export async function getUserXP(
  guildId: string,
  userId: string,
): Promise<IUserXP | null> {
  return await xpRepo.getUserXP(guildId, userId);
}

export async function upsertUserXP(
  guildId: string,
  userId: string,
  data: Partial<IUserXP>,
): Promise<IUserXP> {
  return await xpRepo.upsertUserXP(guildId, userId, data);
}

export async function incrementUserXP(
  guildId: string,
  userId: string,
  xpIncrement: number,
  nivel: number,
  username?: string,
): Promise<IUserXP> {
  return await xpRepo.incrementUserXP(guildId, userId, xpIncrement, nivel, username);
}

export async function getXPConfig(
  guildId: string,
): Promise<IXPConfig | null> {
  return await xpRepo.getConfig(guildId);
}

export async function createXPConfig(
  guildId: string,
  data: IXPConfig,
): Promise<IXPConfig> {
  return await xpRepo.createConfig(guildId, data);
}

export async function updateXPConfig(
  guildId: string,
  data: Partial<IXPConfig>,
): Promise<IXPConfig> {
  return await xpRepo.updateConfig(guildId, data);
}

export async function getLevelRoles(
  guildId: string,
): Promise<ILevelRole[]> {
  return await xpRepo.getLevelRoles(guildId);
}

export async function createLevelRole(
  guildId: string,
  level: number,
  roleId: string,
): Promise<ILevelRole> {
  return await xpRepo.createLevelRole(guildId, level, roleId);
}

export async function deleteLevelRole(
  guildId: string,
  level: number,
): Promise<void> {
  await xpRepo.deleteLevelRole(guildId, level);
}

export async function getXPLeaderboard(
  guildId: string,
  limit: number = 10,
): Promise<XPLeaderboard[]> {
  return await xpRepo.getLeaderboard(guildId, limit);
}
