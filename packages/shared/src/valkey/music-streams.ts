// Stream contracts and constants for Music durable queue
// Follows SDD Phase 6 design

import { KEYS, TTL, STREAMS_CONFIG } from './constants.ts';

/**
 * Stream event types for music queue operations
 */
export const MUSIC_STREAM_EVENTS = {
  ENQUEUE: 'music:enqueue',
  DEQUEUE: 'music:dequeue',
  REMOVE: 'music:remove',
  CLEAR: 'music:clear',
  NOW_PLAYING: 'music:nowplaying',
  UPDATE: 'music:update',
} as const;

/**
 * Stream event envelope (versioned JSON)
 */
export interface StreamEvent<T = Record<string, unknown>> {
  v: 1; // version
  type: string;
  ts: number; // timestamp ms
  data: T;
  messageId?: string; // stream message id
  retryCount?: number; // retry counter for DLQ
}

/**
 * Event data types
 */
export interface EnqueueEventData {
  guildId: string;
  song: {
    title: string;
    url: string;
    duration: number;
    thumbnail?: string;
    requesterId: string;
    requesterName: string;
  };
  queuePosition: number;
}

export interface DequeueEventData {
  guildId: string;
  song: {
    title: string;
    url: string;
    duration: number;
  };
  remaining: number;
}

export interface RemoveEventData {
  guildId: string;
  position: number;
  song: {
    title: string;
    url: string;
  };
  remaining: number;
}

export interface ClearEventData {
  guildId: string;
  clearedCount: number;
}

export interface NowPlayingEventData {
  guildId: string;
  song: {
    title: string;
    url: string;
    duration: number;
    thumbnail?: string;
    requesterId: string;
    requesterName: string;
  };
  queueLength: number;
}

export interface DlqEventData {
  originalEvent: StreamEvent;
  reason: string;
  attempts: number;
  failedAt: number;
  originalMessageId: string;
}

/**
 * Stream builders
 */
export class MusicStreamKeys {
  private prefix: string;
  private env: string;

  constructor(prefix: string = 'cb', env: string = 'development') {
    this.prefix = prefix;
    this.env = env;
  }

  /**
   * Main music stream: cb:stream:music:{guildId}
   */
  musicStream(guildId: string | number): string {
    return `${this.prefix}:${KEYS.STREAM_MUSIC}:${guildId}`;
  }

  /**
   * DLQ stream: cb:stream:music:{guildId}:dlq
   */
  musicDlq(guildId: string | number): string {
    return `${this.prefix}:${KEYS.STREAM_MUSIC}:${guildId}:dlq`;
  }

  /**
   * Consumer group: cb:bot:{env}
   */
  consumerGroup(): string {
    return STREAMS_CONFIG.getConsumerGroup(this.env);
  }

  /**
   * PEL reclaim stream (same as main stream)
   */
  pelReclaimStream(guildId: string | number): string {
    return this.musicStream(guildId);
  }
}

/**
 * Creates MusicStreamKeys instance
 */
export function createMusicStreamKeys(
  prefix: string = 'cb',
  env: string = 'development',
): MusicStreamKeys {
  return new MusicStreamKeys(prefix, env);
}

/**
 * Creates a versioned stream event
 */
export function createStreamEvent<T>(
  type: string,
  data: T,
  options?: {
    messageId?: string;
    retryCount?: number;
  },
): StreamEvent<T> {
  return {
    v: 1,
    type,
    ts: Date.now(),
    data,
    messageId: options?.messageId,
    retryCount: options?.retryCount,
  };
}

/**
 * Parses a stream event from fields
 */
export function parseStreamEvent(
  fields: Record<string, string>,
): StreamEvent | null {
  try {
    const payload = fields.payload;
    if (!payload) return null;

    const parsed = JSON.parse(payload) as StreamEvent;
    if (parsed.v !== 1 || !parsed.type || !parsed.ts || !parsed.data) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Serializes stream event to fields for XADD
 */
export function serializeStreamEvent<T>(event: StreamEvent<T>): Record<string, string> {
  return {
    payload: JSON.stringify(event),
  };
}

/**
 * Stream configuration
 */
export const STREAM_CONFIG = {
  ...STREAMS_CONFIG,
  
  // Consumer settings
  READ_BLOCK_MS: 5000,
  READ_COUNT: 10,
  
  // Reclaim settings
  RECLAIM_INTERVAL_MS: 30_000,
  RECLAIM_MIN_IDLE_MS: 60_000,
  
  // DLQ settings
  DLQ_MAX_LEN: 500,
  
  // Producer settings
  PRODUCER_MAX_LEN: 1000,
} as const;

/**
 * Consumer ID generator (unique per process)
 */
export function createConsumerId(): string {
  return `consumer-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
