import type { IClassConfig } from "@charlybot/shared";

export interface IClassRepository {
  getAll(guildId: string): Promise<IClassConfig[]>;
  getByName(guildId: string, name: string): Promise<IClassConfig | null>;
  add(guildId: string, config: IClassConfig): Promise<void>;
  remove(guildId: string, name: string): Promise<void>;
  exists(guildId: string, name: string): Promise<boolean>;
}
