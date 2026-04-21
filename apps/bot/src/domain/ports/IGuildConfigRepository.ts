import type { IGuildConfig, Guild } from "@charlybot/shared";

export interface IGuildConfigRepository {
  findById(guildId: string): Promise<IGuildConfig | null>;
  upsert(guildId: string, data: Partial<IGuildConfig>): Promise<void>;
  delete(guildId: string): Promise<void>;
  findAll(): Promise<IGuildConfig[]>;

  // Guild metadata
  findGuildById(guildId: string): Promise<Guild | null>;
  upsertGuild(guildId: string, data: Partial<Guild>): Promise<Guild>;
  deleteGuild(guildId: string): Promise<void>;
}
