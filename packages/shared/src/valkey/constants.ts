// Valkey constants: key prefixes, channels, streams
// Follows SDD design: cb:{domain}:...

// Key prefixes (strings)
export const KEYS = {
  // Cache keys
  CACHE: 'cache',
  GUILD_CONFIG: 'guild:config',
  USER_SESSION: 'user:session',
  COMMAND_USAGE: 'cmd:usage',

  // Rate limiting
  RATE_LIMIT: 'ratelimit',

  // Locks
  LOCK: 'lock',

  // Pub/Sub channels - generic, domain-specific channels use this base
  PUBSUB: 'pubsub',

  // Streams - generic, domain-specific streams use this base
  STREAM: 'stream',

  // Stream DLQ - generic suffix appended to stream keys
  STREAM_DLQ: 'dlq',

  // Audit logs
  AUDIT_LOG: 'auditlog',

  // Legacy domain-specific keys (deprecated, use generic + domain param)
  PUBSUB_MUSIC: 'pubsub:music',
  PUBSUB_VERIFICATION: 'pubsub:verification',
  PUBSUB_AUTOROLE: 'pubsub:autorole',
  STREAM_MUSIC: 'stream:music',
  STREAM_VERIFICATION: 'stream:verification',
  STREAM_AUTOROLE: 'stream:autorole',

  // Stream registry (tracking active guild streams)
  STREAM_REGISTRY_MUSIC: 'streams:music:active',

  // Domain-specific streams
  STREAM_LEADERBOARD: 'cb:stream:leaderboard',

  // Anti-spam tracking
  ANTI_SPAM: 'antispam',
} as const;

export const CHANNELS = KEYS;

export const STREAMS = KEYS;

// Anti-spam key builders
export const ANTI_SPAM_KEYS = {
  userMessages: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:messages`,
  userMentions: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:mentions`,
  userLinks: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:links`,
  userLevel: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:level`,
  userDuplicates: (guildId: string, userId: string, hash: string) =>
    `cb:antispam:${guildId}:${userId}:dup:${hash}`,
  // Phase 1 anti-spam foundation keys
  userBurst: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:burst`,
  userVelocity: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:velocity`,
  userEmoji: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:emoji`,
  userCombo: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:combo`,
  userNotified: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:notified`,
  userLock: (guildId: string, userId: string) =>
    `cb:antispam:${guildId}:${userId}:lock`,
} as const;

// TTL constants (in seconds) - use simple object for numeric values
export const TTL: Readonly<{
  CACHE_SHORT: number;
  CACHE_MEDIUM: number;
  CACHE_LONG: number;
  LOCK_DEFAULT: number;
  LOCK_LONG: number;
  RATE_LIMIT_WINDOW: number;
  STREAM_MAX_LEN: number;
  STREAM_REGISTRY_TTL: number;
}> = {
  // Cache TTL defaults (in seconds)
  CACHE_SHORT: 300, // 5 minutes
  CACHE_MEDIUM: 3600, // 1 hour
  CACHE_LONG: 86400, // 24 hours

  // Lock TTL
  LOCK_DEFAULT: 30,
  LOCK_LONG: 60,

  // Rate limit window
  RATE_LIMIT_WINDOW: 60,

  // Stream max length
  STREAM_MAX_LEN: 1000,

  // Stream registry TTL (10 minutes - refresh on each event)
  STREAM_REGISTRY_TTL: 600,
};

export const STREAMS_CONFIG = {
  // Consumer group pattern
  getConsumerGroup: (env: string) => `cb:bot:${env}`,

  // Idle time before reclaim (ms)
  PEL_RECLAIM_IDLE_MS: 60_000,

  // Max retry attempts before DLQ
  MAX_RETRY_ATTEMPTS: 3,
} as const;

// Bot command rate limits (key: command name, value: [limit, windowSeconds])
export const BOT_COMMAND_RATE_LIMITS: Readonly<Record<string, readonly [limit: number, windowSeconds: number]>> = {
  work: [3, 60],      // 3 uses per minute
  crime: [2, 120],    // 2 uses per 2 minutes
  rob: [2, 180],      // 2 uses per 3 minutes
  ruleta: [5, 60],    // 5 uses per minute
  balance: [10, 60],  // 10 uses per minute
  deposit: [5, 60],  // 5 uses per minute
  retire: [5, 60],   // 5 uses per minute

  // Moderation commands
  'mod:warn': [3, 10],     // 3 warns per 10 seconds
  'mod:ban': [2, 10],      // 2 bans per 10 seconds
  'mod:kick': [2, 10],     // 2 kicks per 10 seconds
  'mod:timeout': [3, 10],  // 3 timeouts per 10 seconds
  'mod:clear': [2, 10],    // 2 clears per 10 seconds
  'mod:unban': [2, 10],    // 2 unbans per 10 seconds
  'mod:cases': [5, 10],    // 5 case lookups per 10 seconds
  'mod:reason': [5, 10],   // 5 reason updates per 10 seconds
  'mod:config': [3, 10],   // 3 config changes per 10 seconds
};

// Lock TTL for bot commands (seconds)
export const BOT_LOCK_TTL = {
  TRANSFER: 10,   // 10 seconds for transfer operations
  ROB: 15,        // 15 seconds for rob operations
  ROULETTE: 5,    // 5 seconds for roulette spin
} as const;