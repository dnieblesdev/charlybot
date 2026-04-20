// Music Stream Consumer - consumes queue events from Valkey Streams
// Follows SDD Phase 6 design

import { getValkeyClient } from '../valkey';
import {
  MusicStreamKeys,
  createMusicStreamKeys,
  createStreamEvent,
  parseStreamEvent,
  STREAM_CONFIG,
  MUSIC_STREAM_EVENTS,
  createConsumerId,
  KEYS,
  TTL,
  type StreamEvent,
  type EnqueueEventData,
  type DequeueEventData,
  type RemoveEventData,
  type ClearEventData,
  type NowPlayingEventData,
  type DlqEventData,
} from '@charlybot/shared';
import { loadValkeyConfig } from '@charlybot/shared';
import logger from '../../utils/logger';

/**
 * Handler for stream events
 */
export type StreamEventHandler = (event: StreamEvent) => Promise<void>;

/**
 * MusicStreamConsumer - consumes music queue events from Valkey Streams
 * 
 * Features:
 * - XREADGROUP with BLOCK + batch per guild stream
 * - Consumer groups: cb:bot:{env} (idempotent creation)
 * - ACK only on success
 * - PEL reclaim every 30s
 * - DLQ on >3 retries
 * - Guild stream registry for discovery
 */
class MusicStreamConsumer {
  private keys: MusicStreamKeys;
  private consumerId: string;
  private running: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private reclaimIntervalId: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, StreamEventHandler> = new Map();
  private registryKey: string;
  private knownGuildIds: Set<string> = new Set();
  private consumeLoopInFlight: boolean = false;
  private reclaimInFlight: boolean = false;
  
  // In-memory dedupe for idempotency
  private processedMessages = new Set<string>();
  private maxDedupeSize = 10000;

  constructor() {
    const config = loadValkeyConfig();
    this.keys = createMusicStreamKeys(config.prefix ?? 'cb', config.env ?? 'development');
    this.consumerId = createConsumerId();
    this.registryKey = `${config.prefix ?? 'cb'}:${KEYS.STREAM_REGISTRY_MUSIC}`;
    
    logger.info('MusicStreamConsumer initialized', {
      consumerGroup: this.keys.consumerGroup(),
      consumerId: this.consumerId,
      registryKey: this.registryKey,
    });
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: StreamEventHandler): void {
    this.handlers.set(eventType, handler);
    logger.debug('Stream event handler registered', { eventType });
  }

  /**
   * Start consuming from streams
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('MusicStreamConsumer already running');
      return;
    }

    this.running = true;
    
    // Bootstrap consumer groups for known guilds
    await this.bootstrapConsumerGroups();
    
    // Start the main consumer loop
    this.intervalId = setInterval(() => this.consumeLoop(), 1000);
    
    // Start PEL reclaim job
    this.reclaimIntervalId = setInterval(
      () => this.reclaimPendingEntries(),
      STREAM_CONFIG.RECLAIM_INTERVAL_MS,
    );

    logger.info('MusicStreamConsumer started', {
      consumerId: this.consumerId,
      consumerGroup: this.keys.consumerGroup(),
    });
  }

  /**
   * Stop consuming
   */
  async stop(): Promise<void> {
    this.running = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.reclaimIntervalId) {
      clearInterval(this.reclaimIntervalId);
      this.reclaimIntervalId = null;
    }

    logger.info('MusicStreamConsumer stopped', {
      consumerId: this.consumerId,
    });
  }

  /**
   * Bootstrap consumer groups for all known guild streams
   * Idempotent: XGROUP CREATE with MKSTREAM handles BUSYGROUP error
   */
  private async bootstrapConsumerGroups(): Promise<void> {
    try {
      const client = getValkeyClient();
      const guildIds = await this.getActiveGuildIds();
      
      logger.info('Bootstrapping consumer groups', { guildCount: guildIds.length });
      
      for (const guildId of guildIds) {
        const streamKey = this.keys.musicStream(guildId);
        const consumerGroup = this.keys.consumerGroup();
        
        try {
          // Idempotent: MKSTREAM creates stream if not exists
          await client.streamCreateGroup(streamKey, consumerGroup, '$');
          this.knownGuildIds.add(guildId);
          logger.debug('Consumer group created/verified', { streamKey, consumerGroup });
        } catch (error) {
          logger.warn('Failed to create consumer group', {
            streamKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      logger.info('Consumer group bootstrap complete', {
        created: this.knownGuildIds.size,
      });
    } catch (error) {
      logger.error('Error bootstrapping consumer groups', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get active guild IDs from registry
   */
  private async getActiveGuildIds(): Promise<string[]> {
    try {
      const client = getValkeyClient();
      
      // Get all guild IDs from sorted set (score = timestamp, filter by TTL)
      const now = Date.now();
      const ttlCutoff = now - (TTL.STREAM_REGISTRY_TTL * 1000);
      
      // Use sorted set members with scores to filter expired entries
      const members = await client.sortedSetRangeByScore(this.registryKey, ttlCutoff, now, 1000);
      
      return members;
    } catch (error) {
      logger.warn('Failed to get active guild IDs from registry', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Return known guild IDs as fallback
      return Array.from(this.knownGuildIds);
    }
  }

  /**
   * Main consumer loop - reads from each known guild stream
   */
  private async consumeLoop(): Promise<void> {
    if (!this.running) return;

    // Prevent re-entrancy: setInterval can trigger again while the previous tick is still running.
    // This would pile up Redis commands and hit ioredis commandTimeout.
    if (this.consumeLoopInFlight) return;
    this.consumeLoopInFlight = true;

    try {
      // Refresh guild list from registry
      const guildIds = await this.getActiveGuildIds();
      
      // Add new guilds to known set
      for (const guildId of guildIds) {
        if (!this.knownGuildIds.has(guildId)) {
          this.knownGuildIds.add(guildId);
          // Bootstrap consumer group for new guild
          await this.bootstrapGuildConsumerGroup(guildId);
        }
      }

      const client = getValkeyClient();
      const consumerGroup = this.keys.consumerGroup();
      
      // Read from each known guild stream
      for (const guildId of this.knownGuildIds) {
        const streamKey = this.keys.musicStream(guildId);
        
        try {
          const entries = await client.streamReadGroup(
            streamKey,
            consumerGroup,
            this.consumerId,
            STREAM_CONFIG.READ_COUNT,
            1000, // Short block for faster iteration
          );

          for (const entry of entries) {
            // Track stream key for ACK
            await this.processEntry(streamKey, entry.id, entry.fields);
          }
        } catch (error) {
          logger.debug('Error reading from stream', {
            streamKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

    } catch (error) {
      logger.error('Error in consume loop', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.consumeLoopInFlight = false;
    }
  }

  /**
   * Bootstrap consumer group for a specific guild (idempotent)
   */
  private async bootstrapGuildConsumerGroup(guildId: string): Promise<void> {
    try {
      const client = getValkeyClient();
      const streamKey = this.keys.musicStream(guildId);
      const consumerGroup = this.keys.consumerGroup();
      
      await client.streamCreateGroup(streamKey, consumerGroup, '$');
      logger.info('Consumer group created for new guild', { guildId, streamKey });
    } catch (error) {
      logger.warn('Failed to bootstrap guild consumer group', {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process a single stream entry
   */
  private async processEntry(
    streamKey: string,
    messageId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    // Idempotency check - ACK duplicate to clean PEL
    if (this.processedMessages.has(messageId)) {
      logger.debug('Skipping duplicate message, ACK to clean PEL', { messageId });
      await this.ackMessage(streamKey, messageId);
      return;
    }

    const event = parseStreamEvent(fields);
    if (!event) {
      logger.warn('Failed to parse stream event', { messageId });
      // ACK anyway to avoid stuck messages
      await this.ackMessage(streamKey, messageId);
      return;
    }

    // Check retry count
    const retryCount = (event.retryCount ?? 0) + 1;
    if (retryCount > STREAM_CONFIG.MAX_RETRY_ATTEMPTS) {
      await this.sendToDlq(event, 'max_retries_exceeded', messageId, retryCount);
      await this.ackMessage(streamKey, messageId);
      return;
    }

    try {
      const handler = this.handlers.get(event.type);
      if (!handler) {
        logger.warn('No handler for event type', { type: event.type });
        await this.ackMessage(streamKey, messageId);
        return;
      }

      // Execute handler
      await handler(event);

      // ACK only on success
      await this.ackMessage(streamKey, messageId);
      
      // Add to dedupe
      this.addToDedupe(messageId);

      logger.debug('Stream event processed', {
        type: event.type,
        messageId,
        streamKey,
      });

    } catch (error) {
      logger.error('Error processing stream event', {
        type: event.type,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Strategy: ACK original to clean PEL, republish with incremented retryCount
      // This transfers metadata (retryCount) while keeping PEL clean
      await this.ackMessage(streamKey, messageId);
      await this.republishWithRetry(event, retryCount);
    }
  }

  /**
   * ACK a message for a specific stream
   */
  private async ackMessage(streamKey: string, messageId: string): Promise<void> {
    try {
      const client = getValkeyClient();
      await client.streamAck(
        streamKey,
        this.keys.consumerGroup(),
        [messageId],
      );
    } catch (error) {
      logger.warn('Failed to ACK message', {
        streamKey,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Re-publish event with incremented retry count
   */
  private async republishWithRetry(
    event: StreamEvent,
    retryCount: number,
  ): Promise<void> {
    try {
      const client = getValkeyClient();
      const updatedEvent: StreamEvent = {
        ...event,
        retryCount,
      };
      
      // Extract guildId from original event
      const guildId = (event.data as Record<string, unknown>).guildId as string || 'unknown';
      const streamKey = this.keys.musicStream(guildId);

      await client.streamAdd(
        streamKey,
        { payload: JSON.stringify(updatedEvent) },
        STREAM_CONFIG.PRODUCER_MAX_LEN,
      );
    } catch (error) {
      logger.error('Failed to republish with retry', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send failed event to DLQ
   */
  private async sendToDlq(
    event: StreamEvent,
    reason: string,
    originalMessageId: string,
    attempts: number,
  ): Promise<void> {
    try {
      const client = getValkeyClient();
      
      const dlqData: DlqEventData = {
        originalEvent: event,
        reason,
        attempts,
        failedAt: Date.now(),
        originalMessageId,
      };
      
      const dlqEvent = createStreamEvent('dlq:failed', dlqData);
      
      // Extract guildId from original event
      const guildId = (event.data as Record<string, unknown>).guildId as string || 'unknown';
      
      await client.streamAdd(
        this.keys.musicDlq(guildId),
        { payload: JSON.stringify(dlqEvent) },
        STREAM_CONFIG.DLQ_MAX_LEN,
      );

      logger.warn('Event sent to DLQ', {
        type: event.type,
        originalMessageId,
        reason,
        attempts,
        dlqStream: this.keys.musicDlq(guildId),
      });

    } catch (error) {
      logger.error('Failed to send to DLQ', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * PEL reclaim - claim pending entries that have been idle too long
   */
  private async reclaimPendingEntries(): Promise<void> {
    if (this.reclaimInFlight) return;
    this.reclaimInFlight = true;

    try {
      const client = getValkeyClient();
      
      // For each known guild stream, claim pending entries
      for (const guildId of this.knownGuildIds) {
        const streamKey = this.keys.musicStream(guildId);
        
        try {
          // Get pending entries for this stream
          const pending = await client.streamPending(
            streamKey,
            this.keys.consumerGroup(),
            '-',
            '+',
            100,
          );

          // Filter entries idle > threshold and claim them
          const idleEntries = pending.filter(
            (p) => p.timeSinceDelivered >= STREAM_CONFIG.RECLAIM_MIN_IDLE_MS
          );

          if (idleEntries.length > 0) {
            const messageIds = idleEntries.map((p) => p.id);
            
            const claimed = await client.streamClaim(
              streamKey,
              this.keys.consumerGroup(),
              STREAM_CONFIG.RECLAIM_MIN_IDLE_MS,
              messageIds,
              this.consumerId,
            );

            if (claimed.length > 0) {
              logger.info('Reclaimed pending entries', {
                guildId,
                count: claimed.length,
              });
              
              // Process each claimed entry with the handler
              for (const entry of claimed) {
                try {
                  // Get retry count from pending entry
                  const pendingEntry = idleEntries.find(p => p.id === entry.id);
                  const retryCount = pendingEntry?.deliveryCount ?? 1;
                  
                  // Check retry count and send to DLQ if exceeded
                  if (retryCount > STREAM_CONFIG.MAX_RETRY_ATTEMPTS) {
                    const event = parseStreamEvent(entry.fields);
                    if (event) {
                      await this.sendToDlq(event, 'max_retries_exceeded', entry.id, retryCount);
                    }
                    // ACK original entry to clean it from PEL
                    await this.ackMessage(streamKey, entry.id);
                    continue; // Skip processing, move to next entry
                  }
                  
                  // Process the entry
                  await this.processEntry(streamKey, entry.id, entry.fields);
                  
                  // ACK after successful processing
                  await this.ackMessage(streamKey, entry.id);
                  
                  logger.debug('Reclaimed message processed', { 
                    guildId, 
                    messageId: entry.id,
                    retryCount,
                  });
                } catch (error) {
                  logger.warn('Failed to process reclaimed entry', {
                    guildId,
                    messageId: entry.id,
                    error: error instanceof Error ? error.message : String(error),
                  });
                  // Don't ACK - will be reclaimed again
                }
              }
            }
          }
        } catch (error) {
          logger.debug('Error in PEL reclaim for stream', {
            streamKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

    } catch (error) {
      logger.error('Error in PEL reclaim', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.reclaimInFlight = false;
    }
  }

  /**
   * Add message to in-memory dedupe
   */
  private addToDedupe(messageId: string): void {
    this.processedMessages.add(messageId);
    
    // Clean up old entries to prevent memory growth
    if (this.processedMessages.size > this.maxDedupeSize) {
      const entries = this.processedMessages.values();
      let removed = 0;
      const targetSize = this.maxDedupeSize / 2;
      
      for (const id of entries) {
        if (removed >= targetSize) break;
        this.processedMessages.delete(id);
        removed++;
      }
      
      logger.debug('Cleaned up dedupe cache', {
        removed,
        remaining: this.processedMessages.size,
      });
    }
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }
}

// Singleton instance
let consumerInstance: MusicStreamConsumer | null = null;

/**
 * Get the MusicStreamConsumer singleton
 */
export function getMusicStreamConsumer(): MusicStreamConsumer {
  if (!consumerInstance) {
    consumerInstance = new MusicStreamConsumer();
  }
  return consumerInstance;
}

// Export for lifecycle management
export async function startMusicStreamConsumer(): Promise<void> {
  const consumer = getMusicStreamConsumer();
  await consumer.start();
}

export async function stopMusicStreamConsumer(): Promise<void> {
  if (consumerInstance) {
    await consumerInstance.stop();
  }
}

// Export types
export type { MusicStreamConsumer as MusicStreamConsumerClass };
