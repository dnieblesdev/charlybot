import type {
  IGuildMusicConfig,
  IMusicQueue,
  IMusicQueueItem,
} from "@charlybot/shared";
import type { IMusicRepository } from "../../domain/ports/IMusicRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";

export class HttpMusicAdapter
  extends HttpRepositoryAdapter
  implements IMusicRepository
{
  async getQueue(guildId: string): Promise<IMusicQueue | null> {
    try {
      const response = await this.client.get(`music/queues/${guildId}`);
      return await response.json<IMusicQueue>();
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      return this.handleError(error, `Fetching music queue for ${guildId}`);
    }
  }

  async addToQueue(
    guildId: string,
    track: Omit<IMusicQueueItem, "id" | "queueId" | "position" | "createdAt">
  ): Promise<IMusicQueueItem> {
    try {
      const response = await this.client.post(`music/queues/${guildId}/items`, {
        json: track,
      });
      return await response.json<IMusicQueueItem>();
    } catch (error: any) {
      return this.handleError(error, `Adding track to queue for ${guildId}`);
    }
  }

  async removeFromQueue(guildId: string, position: number): Promise<void> {
    try {
      await this.client.delete(`music/queues/${guildId}/items/${position}`);
    } catch (error: any) {
      return this.handleError(
        error,
        `Removing track from queue at position ${position} for ${guildId}`
      );
    }
  }

  async clearQueue(guildId: string): Promise<void> {
    try {
      await this.client.delete(`music/queues/${guildId}/items`);
    } catch (error: any) {
      return this.handleError(error, `Clearing music queue for ${guildId}`);
    }
  }

  async updateSettings(
    guildId: string,
    settings: Partial<
      Omit<IMusicQueue, "id" | "guildId" | "items" | "updatedAt" | "createdAt">
    >
  ): Promise<IMusicQueue> {
    try {
      const response = await this.client.put(`music/queues/${guildId}/settings`, {
        json: settings,
      });
      return await response.json<IMusicQueue>();
    } catch (error: any) {
      return this.handleError(error, `Updating music settings for ${guildId}`);
    }
  }

  async getConfig(guildId: string): Promise<IGuildMusicConfig | null> {
    try {
      const response = await this.client.get(`music/config/${guildId}`);
      return await response.json<IGuildMusicConfig>();
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      return this.handleError(error, `Fetching music config for ${guildId}`);
    }
  }

  async upsertConfig(
    guildId: string,
    config: Partial<
      Omit<IGuildMusicConfig, "id" | "guildId" | "updatedAt" | "createdAt">
    >
  ): Promise<IGuildMusicConfig> {
    try {
      const response = await this.client.put(`music/config/${guildId}`, {
        json: config,
      });
      return await response.json<IGuildMusicConfig>();
    } catch (error: any) {
      return this.handleError(error, `Updating music config for ${guildId}`);
    }
  }
}
