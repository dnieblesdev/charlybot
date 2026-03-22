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
    try {
      return await this.client
        .get(`economy/config/${guildId}`)
        .json<IEconomyConfig>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async createConfig(
    guildId: string,
    data: IEconomyConfig,
  ): Promise<IEconomyConfig> {
    return await this.client
      .post(`economy/config`, { json: { ...data, guildId } })
      .json<IEconomyConfig>();
  }

  async updateConfig(
    guildId: string,
    data: Partial<IEconomyConfig>,
  ): Promise<IEconomyConfig> {
    return await this.client
      .patch(`economy/config/${guildId}`, { json: data })
      .json<IEconomyConfig>();
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<Leaderboard[]> {
    return await this.client
      .get(`economy/leaderboard/${guildId}`, { searchParams: { limit } })
      .json<Leaderboard[]>();
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
    return await this.client
      .post(`economy/leaderboard/upsert`, { json: { ...data, guildId } })
      .json<Leaderboard>();
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
}
