import type { IUserXP, IXPConfig, ILevelRole } from "@charlybot/shared";
import type { IXPRepository, XPLeaderboard } from "../../domain/ports/IXPRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";
import { memoryCache } from "./MemoryCache";
import { CACHE_KEYS, CACHE_TTL } from "./cacheConstants";

export class HttpXPAdapter
  extends HttpRepositoryAdapter
  implements IXPRepository
{
  async getUserXP(guildId: string, userId: string): Promise<IUserXP | null> {
    try {
      return await this.client
        .get(`xp/${guildId}/${userId}`)
        .json<IUserXP>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async upsertUserXP(
    guildId: string,
    userId: string,
    data: Partial<IUserXP>,
  ): Promise<IUserXP> {
    return await this.client
      .post("xp", { json: { ...data, guildId, userId } })
      .json<IUserXP>();
  }

  async incrementUserXP(
    guildId: string,
    userId: string,
    xpIncrement: number,
    nivel: number,
  ): Promise<IUserXP> {
    return await this.client
      .post("xp/increment", {
        json: { guildId, userId, xpIncrement, nivel, lastMessageAt: new Date() },
      })
      .json<IUserXP>();
  }

  async getConfig(guildId: string): Promise<IXPConfig | null> {
    const cacheKey = CACHE_KEYS.XP_CONFIG(guildId);
    
    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as IXPConfig | null;
    }

    try {
      const result = await this.client
        .get(`xp/config/${guildId}`)
        .json<IXPConfig>();
      memoryCache.set(cacheKey, result, CACHE_TTL.XP_CONFIG);
      return result;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async createConfig(guildId: string, data: IXPConfig): Promise<IXPConfig> {
    const result = await this.client
      .post("xp/config", { json: { ...data, guildId } })
      .json<IXPConfig>();
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.XP_CONFIG(guildId));
    return result;
  }

  async updateConfig(
    guildId: string,
    data: Partial<IXPConfig>,
  ): Promise<IXPConfig> {
    const result = await this.client
      .patch(`xp/config/${guildId}`, { json: data })
      .json<IXPConfig>();
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.XP_CONFIG(guildId));
    return result;
  }

  async getLevelRoles(guildId: string): Promise<ILevelRole[]> {
    const cacheKey = CACHE_KEYS.LEVEL_ROLES(guildId);
    
    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as ILevelRole[];
    }

    const result = await this.client
      .get(`xp/level-roles/${guildId}`)
      .json<ILevelRole[]>();
    memoryCache.set(cacheKey, result, CACHE_TTL.LEVEL_ROLES);
    return result;
  }

  async createLevelRole(
    guildId: string,
    level: number,
    roleId: string,
  ): Promise<ILevelRole> {
    const result = await this.client
      .post("xp/level-roles", { json: { guildId, level, roleId } })
      .json<ILevelRole>();
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.LEVEL_ROLES(guildId));
    return result;
  }

  async deleteLevelRole(guildId: string, level: number): Promise<void> {
    await this.client.delete(`xp/level-roles/${guildId}/${level}`);
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.LEVEL_ROLES(guildId));
  }

  async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<XPLeaderboard[]> {
    const result = await this.client
      .get(`xp/leaderboard/${guildId}`, { searchParams: { limit } })
      .json<XPLeaderboard[]>();
    return result;
  }
}
