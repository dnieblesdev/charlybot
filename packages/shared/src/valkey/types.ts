// Valkey types and interfaces
// Follows SDD design: valkey

import type { Logger } from 'winston';

// =============================================================================
// Config
// =============================================================================

export interface ValkeyConfig {
  host: string;
  port: number;
  password?: string;
  connectTimeoutMs?: number;
  commandTimeoutMs?: number;
  maxRetries?: number;
  prefix?: string;
  env?: string;
}

export const DEFAULT_VALKEY_CONFIG: Omit<Required<ValkeyConfig>, 'password'> = {
  host: 'localhost',
  port: 6379,
  connectTimeoutMs: 5000,
  commandTimeoutMs: 2000,
  maxRetries: 3,
  prefix: 'cb',
  env: 'development',
};

// =============================================================================
// Client Interface
// =============================================================================

export interface ValkeyStreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface ValkeyPendingEntry {
  id: string;
  consumer: string;
  timeSinceDelivered: number;
  deliveryCount: number;
}

export interface IValkeyClient {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Cache operations
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T>;

  // Pub/Sub
  publish(channel: string, payload: object): Promise<void>;
  subscribe(
    channel: string,
    handler: (payload: object) => void,
  ): () => void;

  // Streams
  streamAdd(
    stream: string,
    fields: Record<string, string>,
    maxLen?: number,
  ): Promise<string>;
  streamRead(
    stream: string,
    consumerGroup: string,
    consumer: string,
    count?: number,
  ): Promise<ValkeyStreamEntry[]>;
  streamReadGroup(
    stream: string,
    consumerGroup: string,
    consumer: string,
    count?: number,
    blockMs?: number,
  ): Promise<ValkeyStreamEntry[]>;
  streamAck(
    stream: string,
    consumerGroup: string,
    messageIds: string[],
  ): Promise<void>;
  streamClaim(
    stream: string,
    consumerGroup: string,
    minIdleMs: number,
    messageIds: string[],
    consumer: string,
  ): Promise<ValkeyStreamEntry[]>;
  streamCreateGroup(
    stream: string,
    consumerGroup: string,
    start?: string,
  ): Promise<void>;
  streamPending(
    stream: string,
    consumerGroup: string,
    start?: string,
    end?: string,
    count?: number,
  ): Promise<ValkeyPendingEntry[]>;

  // Rate limiting
  rateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean>;

  // Locks
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;

  // Set operations (for guild stream registry)
  setAdd(key: string, ...members: string[]): Promise<number>;
  setMembers(key: string): Promise<string[]>;
  setRemove(key: string, ...members: string[]): Promise<number>;
  setIsMember(key: string, member: string): Promise<boolean>;

  // Sorted Set operations (for guild stream registry with TTL)
  sortedSetAdd(key: string, score: number, member: string): Promise<number>;
  sortedSetRemove(key: string, member: string): Promise<number>;
  sortedSetRangeByScore(
    key: string,
    min: number,
    max: number,
    limit?: number,
  ): Promise<string[]>;
  sortedSetRemoveByScore(key: string, max: number): Promise<number>;
}

// =============================================================================
// Fallback Store Interface (for ValkeyFallbackWrapper)
// =============================================================================

export interface IFallbackCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

// =============================================================================
// Resilience Types
// =============================================================================

export const CIRCUIT_BREAKER_CONFIG = {
  errorThreshold: 5,
  errorWindowMs: 10_000,
  openDurationMs: 30_000,
} as const;

export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1_000,
} as const;

export type CircuitState = 'closed' | 'open' | 'half-open';

// =============================================================================
// Logger injection (to avoid external dependency in shared)
// =============================================================================

export interface ValkeyLogger {
  error: (msg: string, meta?: object) => void;
  warn: (msg: string, meta?: object) => void;
  info: (msg: string, meta?: object) => void;
  debug: (msg: string, meta?: object) => void;
}