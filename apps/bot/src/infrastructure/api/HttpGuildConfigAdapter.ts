import type { IGuildConfig, Guild } from "@charlybot/shared";
import type { IGuildConfigRepository } from "../../domain/ports/IGuildConfigRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";
import { memoryCache } from "./MemoryCache";
import { CACHE_KEYS, CACHE_TTL } from "./cacheConstants";

export class HttpGuildConfigAdapter
  extends HttpRepositoryAdapter
  implements IGuildConfigRepository
{
  async findById(guildId: string): Promise<IGuildConfig | null> {
    const cacheKey = CACHE_KEYS.GUILD_CONFIG(guildId);
    
    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached as IGuildConfig | null;
    }

    try {
      const response = await this.client.get(`guilds/${guildId}/config`);
      if (response.status === 404) {
        memoryCache.set(cacheKey, null, CACHE_TTL.CONFIG);
        return null;
      }
      const result = await response.json<IGuildConfig>();
      memoryCache.set(cacheKey, result, CACHE_TTL.CONFIG);
      return result;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async upsert(guildId: string, data: Partial<IGuildConfig>): Promise<void> {
    await this.client.patch(`guilds/${guildId}/config`, {
      json: data,
    });
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.GUILD_CONFIG(guildId));
  }

  async delete(guildId: string): Promise<void> {
    await this.client.delete(`guilds/${guildId}/config`);
    // Invalidate cache
    memoryCache.invalidate(CACHE_KEYS.GUILD_CONFIG(guildId));
  }

  async findAll(): Promise<IGuildConfig[]> {
    return await this.client.get("guilds/configs").json<IGuildConfig[]>();
  }

  async findGuildById(guildId: string): Promise<Guild | null> {
    try {
      const response = await this.client.get(`guilds/${guildId}`);
      if (response.status === 404) return null;
      return await response.json<Guild>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async upsertGuild(guildId: string, data: Partial<Guild>): Promise<Guild> {
    return await this.client
      .patch(`guilds/${guildId}`, { json: data })
      .json<Guild>();
  }
}
