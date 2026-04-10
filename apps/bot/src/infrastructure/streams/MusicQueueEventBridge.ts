// Music Queue Event Bridge - integrates stream producer with QueueManagementService
// Follows SDD Phase 6 design - connects queue events to streams

import { getMusicStreamProducer } from './index';
import {
  type EnqueueEventData,
  type DequeueEventData,
  type RemoveEventData,
  type ClearEventData,
  type NowPlayingEventData,
} from '@charlybot/shared';
import logger from '../../utils/logger';

/**
 * Bridge that publishes queue events to Valkey Streams
 * 
 * This is a lightweight integration that wraps the stream producer
 * and handles the bridge between in-memory queue operations and stream events.
 */
class MusicQueueEventBridge {
  private producer = getMusicStreamProducer();
  private enabled: boolean = true;

  /**
   * Publish enqueue event
   */
  async publishEnqueue(
    guildId: string,
    song: {
      title: string;
      url: string;
      duration: number;
      thumbnail?: string;
      requesterId: string;
      requesterName: string;
    },
    queuePosition: number,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const eventData: EnqueueEventData = {
        guildId,
        song,
        queuePosition,
      };
      await this.producer.enqueue(eventData);
    } catch (error) {
      // Don't crash - just log
      logger.warn('Failed to publish enqueue event', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish dequeue event (song started playing)
   */
  async publishDequeue(
    guildId: string,
    song: {
      title: string;
      url: string;
      duration: number;
    },
    remaining: number,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const eventData: DequeueEventData = {
        guildId,
        song,
        remaining,
      };
      await this.producer.dequeue(eventData);
    } catch (error) {
      logger.warn('Failed to publish dequeue event', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish remove event
   */
  async publishRemove(
    guildId: string,
    position: number,
    song: {
      title: string;
      url: string;
    },
    remaining: number,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const eventData: RemoveEventData = {
        guildId,
        position,
        song,
        remaining,
      };
      await this.producer.remove(eventData);
    } catch (error) {
      logger.warn('Failed to publish remove event', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish clear event
   */
  async publishClear(guildId: string, clearedCount: number): Promise<void> {
    if (!this.enabled) return;

    try {
      const eventData: ClearEventData = {
        guildId,
        clearedCount,
      };
      await this.producer.clear(eventData);
    } catch (error) {
      logger.warn('Failed to publish clear event', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publish nowplaying event
   */
  async publishNowPlaying(
    guildId: string,
    song: {
      title: string;
      url: string;
      duration: number;
      thumbnail?: string;
      requesterId: string;
      requesterName: string;
    },
    queueLength: number,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const eventData: NowPlayingEventData = {
        guildId,
        song,
        queueLength,
      };
      await this.producer.nowPlaying(eventData);
    } catch (error) {
      logger.warn('Failed to publish nowplaying event', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Enable/disable bridge
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info('MusicQueueEventBridge enabled', { enabled });
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton
let bridgeInstance: MusicQueueEventBridge | null = null;

/**
 * Get the MusicQueueEventBridge singleton
 */
export function getMusicQueueEventBridge(): MusicQueueEventBridge {
  if (!bridgeInstance) {
    bridgeInstance = new MusicQueueEventBridge();
  }
  return bridgeInstance;
}

// Default export
export default getMusicQueueEventBridge;
