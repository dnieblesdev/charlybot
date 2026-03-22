import type { IClassConfig } from "@charlybot/shared";
import type { IClassRepository } from "../../domain/ports/IClassRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";

export class HttpClassAdapter
  extends HttpRepositoryAdapter
  implements IClassRepository
{
  async getAll(guildId: string): Promise<IClassConfig[]> {
    return await this.client
      .get(`classes/guild/${guildId}`)
      .json<IClassConfig[]>();
  }

  async getByName(guildId: string, name: string): Promise<IClassConfig | null> {
    try {
      return await this.client
        .get(`classes/guild/${guildId}/${name}`)
        .json<IClassConfig>();
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }

  async add(guildId: string, config: IClassConfig): Promise<void> {
    await this.client.post(`classes`, { json: { ...config, guildId } });
  }

  async remove(guildId: string, name: string): Promise<void> {
    await this.client.delete(`classes/guild/${guildId}/${name}`);
  }

  async exists(guildId: string, name: string): Promise<boolean> {
    try {
      const result = await this.getByName(guildId, name);
      return result !== null;
    } catch (error) {
      return false;
    }
  }
}
