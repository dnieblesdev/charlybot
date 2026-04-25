// Music Queue Cache Service - API boundary for Valkey cache operations
// Follows SDD design: migrate Valkey usage out of routes/controllers

import { getValkeyClient } from '../infrastructure/valkey';
import { createValkeyKeys, loadValkeyConfig, BOT_LOCK_TTL, type MusicQueue, type MusicQueueItem, type GuildMusicConfig } from '@charlybot/shared';
import { withDistributedLock, musicQueueLockKey } from '../infrastructure/valkey';

interface CachedMusicQueue {
  id: string;
  guildId: string;
  volume: number;
  loopMode: string;
  isPlaying: boolean;
  isPaused: boolean;
  lastSeek: number | null;
  currentSongId: string | null;
  items: CachedMusicQueueItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface CachedMusicQueueItem {
  id: string;
  queueId: string;
  title: string;
  url: string;
  duration: number | null;
  thumbnail: string | null;
  position: number;
  requesterId: string;
  requesterName: string;
  createdAt: Date;
}

interface CachedGuildMusicConfig {
  id: string;
  guildId: string;
  defaultVolume: number;
  autoCleanup: boolean;
  maxQueueSize: number;
  createdAt: Date;
  updatedAt: Date;
}

// TTL constants (in seconds)
const TTL_MUSIC_QUEUE = 60; // 1 minute
const TTL_GUILD_CONFIG = 300; // 5 minutes

/**
 * Get cache key for music queue using ValkeyKeys builder
 */
function getCacheKey(guildId: string): string {
  const config = loadValkeyConfig();
  const keys = createValkeyKeys(config);
  return keys.cache('music', `queue:${guildId}`);
}

/**
 * Get cache key for music config using ValkeyKeys builder
 */
function getConfigCacheKey(guildId: string): string {
  const config = loadValkeyConfig();
  const keys = createValkeyKeys(config);
  return keys.cache('music', `config:${guildId}`);
}

/**
 * Serialize queue for caching
 */
function serializeQueue(queue: MusicQueue & { items: MusicQueueItem[] }): CachedMusicQueue {
  return {
    id: queue.id,
    guildId: queue.guildId,
    volume: queue.volume,
    loopMode: queue.loopMode,
    isPlaying: queue.isPlaying,
    isPaused: queue.isPaused,
    lastSeek: queue.lastSeek,
    currentSongId: queue.currentSongId,
    items: queue.items.map((item: MusicQueueItem) => ({
      id: item.id,
      queueId: item.queueId,
      title: item.title,
      url: item.url,
      duration: item.duration,
      thumbnail: item.thumbnail,
      position: item.position,
      requesterId: item.requesterId,
      requesterName: item.requesterName,
      createdAt: item.createdAt,
    })),
    createdAt: queue.createdAt,
    updatedAt: queue.updatedAt,
  };
}

/**
 * Serialize config for caching
 */
function serializeConfig(config: GuildMusicConfig): CachedGuildMusicConfig {
  return {
    id: config.id,
    guildId: config.guildId,
    defaultVolume: config.defaultVolume,
    autoCleanup: config.autoCleanup,
    maxQueueSize: config.maxQueueSize,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Music Queue Cache Service - handles all Valkey cache operations for music queues
 */
export class MusicQueueCacheService {
  /**
   * Get cached queue or fetch from DB and cache
   * Fix: avoid double-fetch when cache.set fails - return already-fetched data
   */
  async getQueue(guildId: string, fetchFromDb: () => Promise<(MusicQueue & { items: MusicQueueItem[] }) | null>): Promise<(MusicQueue & { items: MusicQueueItem[] }) | null> {
    const valkey = getValkeyClient();
    const cacheKey = getCacheKey(guildId);

    try {
      // Check cache first
      const cached = await valkey.get<CachedMusicQueue>(cacheKey);
      if (cached !== undefined) {
        return cached as MusicQueue & { items: MusicQueueItem[] };
      }

      // Fetch from DB
      const queue = await fetchFromDb();
      if (queue !== null) {
        // Try to cache - but don't re-fetch if this fails
        try {
          await valkey.set(cacheKey, serializeQueue(queue), TTL_MUSIC_QUEUE);
        } catch {
          // Cache set failed - but we already have the data, so return it
          // No need to re-fetch from DB
        }
      }

      return queue;
    } catch {
      // Valkey unavailable - fetch directly without caching
      return fetchFromDb();
    }
  }

  /**
   * Invalidate queue cache
   */
  async invalidateQueue(guildId: string): Promise<void> {
    const valkey = getValkeyClient();
    const cacheKey = getCacheKey(guildId);

    try {
      await valkey.del(cacheKey);
    } catch {
      // Ignore cache errors
    }
  }

  /**
   * Get cached music config or fetch from DB and cache
   */
  async getConfig(guildId: string, fetchFromDb: () => Promise<GuildMusicConfig | null>): Promise<GuildMusicConfig | null> {
    const valkey = getValkeyClient();
    const cacheKey = getConfigCacheKey(guildId);

    try {
      // Check cache first
      const cached = await valkey.get<CachedGuildMusicConfig>(cacheKey);
      if (cached !== undefined) {
        return cached as GuildMusicConfig;
      }

      // Fetch from DB
      const config = await fetchFromDb();
      if (config !== null) {
        // Cache the result
        await valkey.set(cacheKey, serializeConfig(config), TTL_GUILD_CONFIG);
      }

      return config;
    } catch {
      // Fallback: fetch from DB directly if cache fails
      return fetchFromDb();
    }
  }

/**
 * Invalidate music config cache
   */
  async invalidateConfig(guildId: string): Promise<void> {
    const valkey = getValkeyClient();
    const cacheKey = getConfigCacheKey(guildId);

    try {
      await valkey.del(cacheKey);
    } catch {
      // Ignore cache errors
    }
  }

  /**
   * Execute a queue modification with distributed lock to prevent concurrent modifications
   */
  async withQueueLock<T>(
    guildId: string,
    fn: () => Promise<T>,
    ttlSeconds: number = BOT_LOCK_TTL.ROULETTE,
  ): Promise<T> {
    const lockKey = `music:queue:${guildId}`;
    return await withDistributedLock('music', lockKey, fn, ttlSeconds);
  }
}

// Singleton instance
let musicQueueCacheService: MusicQueueCacheService | null = null;

/**
 * Get MusicQueueCacheService singleton
 */
export function getMusicQueueCacheService(): MusicQueueCacheService {
  if (!musicQueueCacheService) {
    musicQueueCacheService = new MusicQueueCacheService();
  }
  return musicQueueCacheService;
}