import type { IUserXP, IXPConfig, ILevelRole } from "@charlybot/shared";

export interface XPLeaderboard {
  userId: string;
  username: string;
  xp: number;
  nivel: number;
}

export interface IXPRepository {
  getUserXP(guildId: string, userId: string): Promise<IUserXP | null>;
  upsertUserXP(guildId: string, userId: string, data: Partial<IUserXP>): Promise<IUserXP>;
  incrementUserXP(guildId: string, userId: string, xpIncrement: number, nivel: number, username?: string): Promise<IUserXP>;
  getConfig(guildId: string): Promise<IXPConfig | null>;
  createConfig(guildId: string, data: IXPConfig): Promise<IXPConfig>;
  updateConfig(guildId: string, data: Partial<IXPConfig>): Promise<IXPConfig>;
  getLevelRoles(guildId: string): Promise<ILevelRole[]>;
  createLevelRole(guildId: string, level: number, roleId: string): Promise<ILevelRole>;
  deleteLevelRole(guildId: string, level: number): Promise<void>;
  getLeaderboard(guildId: string, limit?: number): Promise<XPLeaderboard[]>;
}
