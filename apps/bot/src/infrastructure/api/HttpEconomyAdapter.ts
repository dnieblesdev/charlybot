import type {
  IUserEconomy,
  IGlobalBank,
  IEconomyConfig,
  RouletteGame,
  RouletteBet,
  Leaderboard,
} from "@charlybot/shared";
import type { IEconomyRepository } from "../../domain/ports/IEconomyRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";
import { memoryCache } from "./MemoryCache";
import { CACHE_KEYS, CACHE_TTL } from "./cacheConstants";

export interface TransferResult {
  success: boolean;
  fromUser: IUserEconomy;
  toUser: IUserEconomy;
}

export interface DepositResult {
  success: boolean;
  user: IUserEconomy;
  bank: IGlobalBank;
}

export interface WithdrawResult {
  success: boolean;
  bank: IGlobalBank;
  user: IUserEconomy;
}

export class HttpEconomyAdapter
  extends HttpRepositoryAdapter
  implements IEconomyRepository
{
  async getUser(guildId: string, userId: string): Promise<IUserEconomy | null> {
    try {
      return await this.client
        .get(`economy/user/${guildId}/${userId}`)
        .json<IUserEconomy>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async createUser(guildId: string, data: IUserEconomy): Promise<IUserEconomy> {
    return await this.client
      .post(`economy/user`, { json: { ...data, guildId } })
      .json<IUserEconomy>();
  }

  async updateUser(
    guildId: string,
    userId: string,
    data: Partial<IUserEconomy>,
  ): Promise<IUserEconomy> {
    return await this.client
      .patch(`economy/user/${guildId}/${userId}`, { json: data })
      .json<IUserEconomy>();
  }

  async getGlobalBank(
    guildId: string,
    userId: string,
  ): Promise<IGlobalBank | null> {
    try {
      return await this.client
        .get(`economy/bank/${userId}`)
        .json<IGlobalBank>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async createGlobalBank(
    guildId: string,
    data: IGlobalBank,
  ): Promise<IGlobalBank> {
    return await this.client
      .post(`economy/bank`, { json: data })
      .json<IGlobalBank>();
  }

  async updateGlobalBank(
    guildId: string,
    userId: string,
    data: Partial<IGlobalBank>,
  ): Promise<IGlobalBank> {
    return await this.client
      .patch(`economy/bank/${userId}`, { json: data })
      .json<IGlobalBank>();
  }

  async getConfig(guildId: string): Promise<IEconomyConfig | null> {
    const cacheKey = CACHE_KEYS.ECONOMY_CONFIG(guildId);
    
    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as IEconomyConfig | null;
    }

    try {
      const result = await this.client
        .get(`economy/config/${guildId}`)
        .json<IEconomyConfig>();
      memoryCache.set(cacheKey, result, CACHE_TTL.CONFIG);
      return result;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async createConfig(
    guildId: string,
    data: IEconomyConfig,
  ): Promise<IEconomyConfig> {
    const result = await this.client
      .post(`economy/config`, { json: { ...data, guildId } })
      .json<IEconomyConfig>();
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.ECONOMY_CONFIG(guildId));
    return result;
  }

  async updateConfig(
    guildId: string,
    data: Partial<IEconomyConfig>,
  ): Promise<IEconomyConfig> {
    const result = await this.client
      .patch(`economy/config/${guildId}`, { json: data })
      .json<IEconomyConfig>();
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.ECONOMY_CONFIG(guildId));
    return result;
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<Leaderboard[]> {
    const cacheKey = `${CACHE_KEYS.LEADERBOARD(guildId)}:${limit}`;
    
    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as Leaderboard[];
    }

    const result = await this.client
      .get(`economy/leaderboard/${guildId}`, { searchParams: { limit } })
      .json<Leaderboard[]>();
    memoryCache.set(cacheKey, result, CACHE_TTL.LEADERBOARD);
    return result;
  }

  async getLeaderboardEntry(
    guildId: string,
    userId: string,
  ): Promise<Leaderboard | null> {
    try {
      return await this.client
        .get(`economy/leaderboard/${guildId}/user/${userId}`)
        .json<Leaderboard>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async upsertLeaderboard(
    guildId: string,
    data: Partial<Leaderboard>,
  ): Promise<Leaderboard> {
    const result = await this.client
      .post(`economy/leaderboard/upsert`, { json: { ...data, guildId } })
      .json<Leaderboard>();
    // Invalidate leaderboard cache for all limits
    memoryCache.invalidatePattern(`${CACHE_KEYS.LEADERBOARD(guildId)}:*`);
    return result;
  }

  async getUserPosition(
    guildId: string,
    userId: string,
  ): Promise<number | null> {
    const res = await this.client
      .get(`economy/leaderboard/${guildId}/position/${userId}`)
      .json<{ position: number | null }>();
    return res.position;
  }

  async removeFromLeaderboard(guildId: string, userId: string): Promise<void> {
    await this.client.delete(`economy/leaderboard/${guildId}/${userId}`);
    // Invalidate leaderboard cache
    memoryCache.invalidatePattern(`${CACHE_KEYS.LEADERBOARD(guildId)}:*`);
  }

  // --- Roulette ---

  async createRouletteGame(
    guildId: string,
    data: Partial<RouletteGame>,
  ): Promise<RouletteGame> {
    return await this.client
      .post(`economy/roulette/game`, { json: { ...data, guildId } })
      .json<RouletteGame>();
  }

  async getActiveRouletteGame(
    guildId: string,
    channelId: string,
  ): Promise<RouletteGame | null> {
    try {
      return await this.client
        .get(`economy/roulette/game/${channelId}/active`)
        .json<RouletteGame>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async placeRouletteBet(
    guildId: string,
    gameId: number,
    data: Partial<RouletteBet>,
  ): Promise<RouletteBet> {
    return await this.client
      .post(`economy/roulette/game/${gameId}/bet`, {
        json: { ...data, guildId },
      })
      .json<RouletteBet>();
  }

  async updateRouletteGame(
    guildId: string,
    gameId: number,
    data: Partial<RouletteGame>,
  ): Promise<RouletteGame> {
    return await this.client
      .patch(`economy/roulette/game/${gameId}`, { json: data })
      .json<RouletteGame>();
  }

  async getRouletteGame(
    guildId: string,
    gameId: number,
  ): Promise<RouletteGame> {
    return await this.client
      .get(`economy/roulette/game/${gameId}`)
      .json<RouletteGame>();
  }

  async updateRouletteBet(
    guildId: string,
    betId: number,
    data: Partial<RouletteBet>,
  ): Promise<RouletteBet> {
    return await this.client
      .patch(`economy/roulette/bet/${betId}`, { json: data })
      .json<RouletteBet>();
  }

  async deleteRouletteGame(guildId: string, gameId: number): Promise<void> {
    await this.client.delete(`economy/roulette/game/${gameId}`);
  }

  // --- Atomic Operations (Race Condition Fix) ---

  async transfer(
    fromUserId: string,
    toUserId: string,
    guildId: string,
    amount: number,
    fromUsername: string,
    toUsername: string,
  ): Promise<TransferResult> {
    return await this.client
      .post("economy/transfer", {
        json: {
          fromUserId,
          toUserId,
          guildId,
          amount,
          fromUsername,
          toUsername,
        },
      })
      .json<TransferResult>();
  }

  async deposit(
    userId: string,
    guildId: string,
    username: string,
    amount: number,
  ): Promise<DepositResult> {
    return await this.client
      .post("economy/deposit", {
        json: {
          userId,
          guildId,
          username,
          amount,
        },
      })
      .json<DepositResult>();
  }

  async withdraw(
    userId: string,
    guildId: string,
    username: string,
    amount: number,
  ): Promise<WithdrawResult> {
    return await this.client
      .post("economy/withdraw", {
        json: {
          userId,
          guildId,
          username,
          amount,
        },
      })
      .json<WithdrawResult>();
  }
}
