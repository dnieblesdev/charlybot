// Music Stream Producer - publishes queue events to Valkey Streams
// Follows SDD Phase 6 design

import { getValkeyClient } from '../valkey';
import {
  MusicStreamKeys,
  createMusicStreamKeys,
  createStreamEvent,
  serializeStreamEvent,
  STREAM_CONFIG,
  MUSIC_STREAM_EVENTS,
  TTL,
  KEYS,
  type StreamEvent,
  type EnqueueEventData,
  type DequeueEventData,
  type RemoveEventData,
  type ClearEventData,
  type NowPlayingEventData,
} from '@charlybot/shared';
import { loadValkeyConfig } from '@charlybot/shared';
import logger from '../../utils/logger';

/**
 * MusicStreamProducer - publishes music queue events to Valkey Streams
 * 
 * Events published:
 * - music:enqueue - when a song is added to queue
 * - music:dequeue - when a song is removed from queue (play)
 * - music:remove - when a song is removed by position
 * - music:clear - when queue is cleared
 * - music:nowplaying - when current song changes
 * 
 * Also maintains a registry of active guild streams for consumer discovery.
 */
class MusicStreamProducer {
  private keys: MusicStreamKeys;
  private enabled: boolean = false;
  private registryKey: string;

  constructor() {
    const config = loadValkeyConfig();
    this.keys = createMusicStreamKeys(config.prefix ?? 'cb', config.env ?? 'development');
    this.registryKey = `${config.prefix ?? 'cb'}:${KEYS.STREAM_REGISTRY_MUSIC}`;
    this.enabled = true;
    logger.info('MusicStreamProducer initialized', {
      consumerGroup: this.keys.consumerGroup(),
      enabled: this.enabled,
      registryKey: this.registryKey,
    });
  }

  /**
   * Register a guild as having an active music stream
   * Called by producer when publishing any event
   */
  private async registerGuildStream(guildId: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const client = getValkeyClient();
      // Use sorted set with timestamp as score for TTL
      await client.sortedSetAdd(this.registryKey, Date.now(), guildId);
      // Refresh TTL
      await client.setAdd(this.registryKey + ':set', guildId);
      // We'll clean up expired entries in a background job or let them naturally expire
      logger.debug('Registered guild stream', { guildId, registry: this.registryKey });
    } catch (error) {
      logger.warn('Failed to register guild stream', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publishes an event to the music stream
   */
  private async publish<T>(
    eventType: string,
    data: T,
  ): Promise<string | null> {
    if (!this.enabled) {
      return null;
    }

    // Extract guildId for registry
    const guildId = data && (data as Record<string, unknown>).guildId
      ? String((data as Record<string, unknown>).guildId)
      : null;

    // Register guild stream before publishing
    if (guildId) {
      await this.registerGuildStream(guildId);
    }

    try {
      const client = getValkeyClient();
      const event = createStreamEvent(eventType, data);
      const streamKey = guildId 
        ? this.keys.musicStream(guildId)
        : this.keys.musicStream('unknown');
      
      const messageId = await client.streamAdd(
        streamKey,
        serializeStreamEvent(event),
        STREAM_CONFIG.PRODUCER_MAX_LEN,
      );

      logger.debug('Stream event published', {
        type: eventType,
        messageId,
        stream: streamKey,
      });

      return messageId;
    } catch (error) {
      // Streams throw on failure per design - log and continue
      logger.error('Failed to publish stream event', {
        type: eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return null to not crash the bot
      return null;
    }
  }

  /**
   * Publish enqueue event
   */
  async enqueue(data: EnqueueEventData): Promise<string | null> {
    return this.publish(MUSIC_STREAM_EVENTS.ENQUEUE, data);
  }

  /**
   * Publish dequeue event (song started playing)
   */
  async dequeue(data: DequeueEventData): Promise<string | null> {
    return this.publish(MUSIC_STREAM_EVENTS.DEQUEUE, data);
  }

  /**
   * Publish remove event (song removed by position)
   */
  async remove(data: RemoveEventData): Promise<string | null> {
    return this.publish(MUSIC_STREAM_EVENTS.REMOVE, data);
  }

  /**
   * Publish clear event (queue cleared)
   */
  async clear(data: ClearEventData): Promise<string | null> {
    return this.publish(MUSIC_STREAM_EVENTS.CLEAR, data);
  }

  /**
   * Publish nowplaying event (current song updated)
   */
  async nowPlaying(data: NowPlayingEventData): Promise<string | null> {
    return this.publish(MUSIC_STREAM_EVENTS.NOW_PLAYING, data);
  }

  /**
   * Check if producer is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Disable producer (e.g., when Valkey is down)
   */
  disable(): void {
    this.enabled = false;
    logger.info('MusicStreamProducer disabled');
  }

  /**
   * Enable producer
   */
  enable(): void {
    this.enabled = true;
    logger.info('MusicStreamProducer enabled');
  }
}

// Singleton instance
let producerInstance: MusicStreamProducer | null = null;

/**
 * Get the MusicStreamProducer singleton
 */
export function getMusicStreamProducer(): MusicStreamProducer {
  if (!producerInstance) {
    producerInstance = new MusicStreamProducer();
  }
  return producerInstance;
}

// Export default for convenience
export default getMusicStreamProducer;
