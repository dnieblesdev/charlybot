import { HttpEconomyAdapter } from "../../infrastructure/api/HttpEconomyAdapter";
import logger from "../../utils/logger";
import type {
  IUserEconomy,
  IGlobalBank,
  IEconomyConfig,
  Leaderboard,
  RouletteGame,
  RouletteBet,
} from "@charlybot/shared";

// Instancia del adaptador (Port implementation)
const economyRepo = new HttpEconomyAdapter();

export async function getEconomyUser(
  guildId: string,
  userId: string,
): Promise<IUserEconomy | null> {
  return await economyRepo.getUser(guildId, userId);
}

export async function createEconomyUser(
  guildId: string,
  data: IUserEconomy,
): Promise<IUserEconomy> {
  return await economyRepo.createUser(guildId, data);
}

export async function updateEconomyUser(
  guildId: string,
  userId: string,
  data: Partial<IUserEconomy>,
): Promise<IUserEconomy> {
  return await economyRepo.updateUser(guildId, userId, data);
}

export async function getGlobalBank(
  guildId: string,
  userId: string,
): Promise<IGlobalBank | null> {
  return await economyRepo.getGlobalBank(guildId, userId);
}

export async function createGlobalBank(
  guildId: string,
  data: IGlobalBank,
): Promise<IGlobalBank> {
  return await economyRepo.createGlobalBank(guildId, data);
}

export async function updateGlobalBank(
  guildId: string,
  userId: string,
  data: Partial<IGlobalBank>,
): Promise<IGlobalBank> {
  return await economyRepo.updateGlobalBank(guildId, userId, data);
}

export async function getEconomyConfig(
  guildId: string,
): Promise<IEconomyConfig | null> {
  return await economyRepo.getConfig(guildId);
}

export async function createEconomyConfig(
  guildId: string,
  data: IEconomyConfig,
): Promise<IEconomyConfig> {
  return await economyRepo.createConfig(guildId, data);
}

export async function updateEconomyConfig(
  guildId: string,
  data: Partial<IEconomyConfig>,
): Promise<IEconomyConfig> {
  return await economyRepo.updateConfig(guildId, data);
}

export async function getLeaderboard(
  guildId: string,
  limit: number = 10,
): Promise<Leaderboard[]> {
  return await economyRepo.getLeaderboard(guildId, limit);
}

export async function getLeaderboardEntry(
  guildId: string,
  userId: string,
): Promise<Leaderboard | null> {
  return await economyRepo.getLeaderboardEntry(guildId, userId);
}

export async function upsertLeaderboard(
  guildId: string,
  data: Partial<Leaderboard>,
): Promise<Leaderboard> {
  return await economyRepo.upsertLeaderboard(guildId, data);
}

export async function getUserPosition(
  guildId: string,
  userId: string,
): Promise<number | null> {
  return await economyRepo.getUserPosition(guildId, userId);
}

export async function removeFromLeaderboard(
  guildId: string,
  userId: string,
): Promise<void> {
  await economyRepo.removeFromLeaderboard(guildId, userId);
}

// --- Roulette ---

export async function createRouletteGame(
  guildId: string,
  data: Partial<RouletteGame>,
): Promise<RouletteGame> {
  return await economyRepo.createRouletteGame(guildId, data);
}

export async function getActiveRouletteGame(
  guildId: string,
  channelId: string,
): Promise<RouletteGame | null> {
  return await economyRepo.getActiveRouletteGame(guildId, channelId);
}

export async function placeRouletteBet(
  guildId: string,
  gameId: number,
  data: Partial<RouletteBet>,
): Promise<RouletteBet> {
  return await economyRepo.placeRouletteBet(guildId, gameId, data);
}

export async function updateRouletteGame(
  guildId: string,
  gameId: number,
  data: Partial<RouletteGame>,
): Promise<RouletteGame> {
  return await economyRepo.updateRouletteGame(guildId, gameId, data);
}

export async function getRouletteGame(
  guildId: string,
  gameId: number,
): Promise<RouletteGame> {
  return await economyRepo.getRouletteGame(guildId, gameId);
}

export async function updateRouletteBet(
  guildId: string,
  betId: number,
  data: Partial<RouletteBet>,
): Promise<RouletteBet> {
  return await economyRepo.updateRouletteBet(guildId, betId, data);
}

export async function deleteRouletteGame(
  guildId: string,
  gameId: number,
): Promise<void> {
  await economyRepo.deleteRouletteGame(guildId, gameId);
}
