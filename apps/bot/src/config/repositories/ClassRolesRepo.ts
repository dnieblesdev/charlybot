import { HttpClassAdapter } from "../../infrastructure/api/HttpClassAdapter";
import logger from "../../utils/logger";
import type { IClassConfig } from "@charlybot/shared";

// Instancia del adaptador (Port implementation)
const classRepo = new HttpClassAdapter();

export async function addClass(guildId: string, classConfig: IClassConfig): Promise<void> {
  await classRepo.add(guildId, classConfig);
  logger.info(`✅ Clase añadida via API: ${classConfig.name} en ${guildId}`);
}

export async function getClass(guildId: string, name: string): Promise<IClassConfig | null> {
  return await classRepo.getByName(guildId, name);
}

export async function getAllClasses(guildId: string): Promise<IClassConfig[]> {
  return await classRepo.getAll(guildId);
}

export async function removeClass(guildId: string, name: string): Promise<void> {
  await classRepo.remove(guildId, name);
  logger.info(`🗑️ Clase eliminada via API: ${name} en ${guildId}`);
}

export async function classExists(guildId: string, name: string): Promise<boolean> {
  return await classRepo.exists(guildId, name);
}
