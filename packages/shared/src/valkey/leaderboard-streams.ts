// Leaderboard Stream - types and constants for async leaderboard updates
// Follows the same pattern as music-streams.ts

import { TTL, KEYS } from './constants.ts';

// Stream configuration
export const LEADERBOARD_STREAM_CONFIG = {
  /** Max stream length (keep last 1000 events) */
  MAX_LEN: 1000,
  /** Block timeout for XREADGROUP (ms) */
  BLOCK_MS: 5000,
  /** Batch size per read */
  BATCH_SIZE: 10,
  /** Max retries before DLQ */
  MAX_RETRIES: 3,
  /** PEL reclaim interval (ms) */
  RECLAIM_INTERVAL_MS: 30_000,
  /** Min idle time before reclaim (ms) */
  MIN_IDLE_MS: 60_000,
} as const;

// Event types
export const LEADERBOARD_STREAMS_EVENTS = {
  UPDATE: 'leaderboard:update',
} as const;

// Event data interface
export interface LeaderboardUpdateData {
  guildId: string;
  userId: string;
  username: string;
}

// Stream event envelope
export interface LeaderboardStreamEvent {
  v: number;
  type: string;
  ts: number;
  data: LeaderboardUpdateData;
}

// Stream keys
export interface LeaderboardStreamKeys {
  stream: string;
  dlq: string;
  consumerGroup: string;
}

export function createLeaderboardStreamKeys(env: string): LeaderboardStreamKeys {
  return {
    stream: `${KEYS.STREAM}:leaderboard`,
    dlq: `${KEYS.STREAM}:leaderboard:${KEYS.STREAM_DLQ}`,
    consumerGroup: `cb:bot:${env}`,
  };
}

// Consumer ID (unique per process)
export function createLeaderboardConsumerId(): string {
  return `${process.env.HOSTNAME ?? 'bot'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}