// Music Queue Cache Service - API boundary for Valkey cache operations
// Follows SDD design: migrate Valkey usage out of routes/controllers

import { getValkeyClient } from '../infrastructure/valkey';
import { createValkeyKeys, loadValkeyConfig } from '@charlybot/shared';
import type { MusicQueue, MusicQueueItem, GuildMusicConfig } from '@prisma/client';

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
  artist: string | null;
  url: string;
  duration: number | null;
  position: number;
}

interface CachedGuildMusicConfig {
  id: string;
  guildId: string;
  defaultVolume: number;
  autoPlay: boolean;
  djMode: boolean;
  textChannelId: string | null;
  voiceChannelId: string | null;
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
    items: queue.items.map((item) => ({
      id: item.id,
      queueId: item.queueId,
      title: item.title,
      artist: item.artist,
      url: item.url,
      duration: item.duration,
      position: item.position,
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
    autoPlay: config.autoPlay,
    djMode: config.djMode,
    textChannelId: config.textChannelId,
    voiceChannelId: config.voiceChannelId,
  };
}

/**
 * Music Queue Cache Service - handles all Valkey cache operations for music queues
 */
export class MusicQueueCacheService {
  /**
   * Get cached queue or fetch from DB and cache
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
        // Cache the result
        await valkey.set(cacheKey, serializeQueue(queue), TTL_MUSIC_QUEUE);
      }

      return queue;
    } catch {
      // Fallback: fetch from DB directly if cache fails
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