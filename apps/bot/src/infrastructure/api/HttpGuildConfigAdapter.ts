import type { IGuildConfig, Guild } from "@charlybot/shared";
import type { IGuildConfigRepository } from "../../domain/ports/IGuildConfigRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";

export class HttpGuildConfigAdapter
  extends HttpRepositoryAdapter
  implements IGuildConfigRepository
{
  async findById(guildId: string): Promise<IGuildConfig | null> {
    try {
      const response = await this.client.get(`guilds/${guildId}/config`);
      if (response.status === 404) return null;
      return await response.json<IGuildConfig>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async upsert(guildId: string, data: Partial<IGuildConfig>): Promise<void> {
    await this.client.patch(`guilds/${guildId}/config`, {
      json: data,
    });
  }

  async delete(guildId: string): Promise<void> {
    await this.client.delete(`guilds/${guildId}/config`);
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
