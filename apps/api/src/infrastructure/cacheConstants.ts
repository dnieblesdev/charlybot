// Cache TTL constants (in seconds for Valkey)
export const CACHE_TTL = {
  MUSIC_QUEUE: 60,           // 1 minute
  MUSIC_CONFIG: 300,        // 5 minutes
  GUILD_CONFIG: 300,        // 5 minutes
  LEADERBOARD: 300,         // 5 minutes
} as const;

// Cache key generators
export const CACHE_KEYS = {
  MUSIC_QUEUE: (guildId: string) => `music:queue:${guildId}`,
  MUSIC_CONFIG: (guildId: string) => `music:config:${guildId}`,
  GUILD_CONFIG: (guildId: string) => `guild:config:${guildId}`,
  LEADERBOARD: (guildId: string) => `leaderboard:${guildId}`,
} as const;
