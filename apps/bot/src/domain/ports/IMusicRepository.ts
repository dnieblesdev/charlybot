import type { IGuildMusicConfig, IMusicQueue, IMusicQueueItem } from "@charlybot/shared";

export interface IMusicRepository {
  /**
   * Retrieves the music queue for a guild, including its items.
   * @param guildId The Discord guild ID.
   */
  getQueue(guildId: string): Promise<IMusicQueue | null>;

  /**
   * Adds a track to the guild's music queue.
   * @param guildId The Discord guild ID.
   * @param track The track data to add.
   */
  addToQueue(
    guildId: string,
    track: Omit<IMusicQueueItem, "id" | "queueId" | "position" | "createdAt">
  ): Promise<IMusicQueueItem>;

  /**
   * Removes a track from the queue at a specific position.
   * @param guildId The Discord guild ID.
   * @param position The 0-based position in the queue.
   */
  removeFromQueue(guildId: string, position: number): Promise<void>;

  /**
   * Clears all items from the guild's music queue.
   * @param guildId The Discord guild ID.
   */
  clearQueue(guildId: string): Promise<void>;

  /**
   * Updates queue settings like volume, loop mode, and playback state.
   * @param guildId The Discord guild ID.
   * @param settings The settings to update.
   */
  updateSettings(
    guildId: string,
    settings: Partial<
      Omit<IMusicQueue, "id" | "guildId" | "items" | "updatedAt" | "createdAt">
    >
  ): Promise<IMusicQueue>;

  /**
   * Retrieves the music configuration for a guild.
   * @param guildId The Discord guild ID.
   */
  getConfig(guildId: string): Promise<IGuildMusicConfig | null>;

  /**
   * Creates or updates the music configuration for a guild.
   * @param guildId The Discord guild ID.
   * @param config The configuration to upsert.
   */
  upsertConfig(
    guildId: string,
    config: Partial<
      Omit<IGuildMusicConfig, "id" | "guildId" | "updatedAt" | "createdAt">
    >
  ): Promise<IGuildMusicConfig>;
}
