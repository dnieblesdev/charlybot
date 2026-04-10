import type { IGuildConfig, Guild } from "@charlybot/shared";
import type { IGuildConfigRepository } from "../../domain/ports/IGuildConfigRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";
import { getValkeyClient } from "../valkey";
import { CACHE_KEYS, CACHE_TTL } from "./cacheConstants";

export class HttpGuildConfigAdapter
  extends HttpRepositoryAdapter
  implements IGuildConfigRepository
{
  async findById(guildId: string): Promise<IGuildConfig | null> {
    const cacheKey = CACHE_KEYS.GUILD_CONFIG(guildId);
    const valkey = getValkeyClient();

    // Check distributed cache first
    const cached = await valkey.get<IGuildConfig | null>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch from API
    try {
      const response = await this.client.get(`guilds/${guildId}/config`);
      if (response.status === 404) {
        await valkey.set<null>(cacheKey, null, CACHE_TTL.CONFIG / 1000);
        return null;
      }
      const result = await response.json<IGuildConfig>();
      await valkey.set<IGuildConfig>(cacheKey, result, CACHE_TTL.CONFIG / 1000);
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
    // Invalidate distributed cache
    const cacheKey = CACHE_KEYS.GUILD_CONFIG(guildId);
    const valkey = getValkeyClient();
    await valkey.del(cacheKey);
  }

  async delete(guildId: string): Promise<void> {
    await this.client.delete(`guilds/${guildId}/config`);
    // Invalidate distributed cache
    const cacheKey = CACHE_KEYS.GUILD_CONFIG(guildId);
    const valkey = getValkeyClient();
    await valkey.del(cacheKey);
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
