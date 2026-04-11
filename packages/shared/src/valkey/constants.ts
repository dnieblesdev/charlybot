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
} as const;

export const CHANNELS = KEYS;

export const STREAMS = KEYS;

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