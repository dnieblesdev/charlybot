// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  CONFIG: 5 * 60 * 1000,      // 5 minutes
  LEADERBOARD: 5 * 60 * 1000, // 5 minutes
} as const;

// Cache key generators
export const CACHE_KEYS = {
  GUILD_CONFIG: (guildId: string) => `guildConfig:${guildId}`,
  ECONOMY_CONFIG: (guildId: string) => `economyConfig:${guildId}`,
  LEADERBOARD: (guildId: string) => `leaderboard:${guildId}`,
} as const;
