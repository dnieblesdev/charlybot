// Key builders for Valkey
// Follows spec: cb:{domain}:{resource}:{id}

import { KEYS } from './constants.ts';
import type { ValkeyConfig } from './types.ts';

export class ValkeyKeys {
  private prefix: string;

  constructor(config: ValkeyConfig) {
    this.prefix = config.prefix ?? 'cb';
  }

  private build(...parts: (string | number)[]): string {
    return parts.map((p) => String(p)).join(':');
  }

  // Cache keys
  cache(domain: string, id: string): string {
    return this.build(this.prefix, KEYS.CACHE, domain, id);
  }

  guildConfig(guildId: string | number): string {
    return this.build(this.prefix, KEYS.GUILD_CONFIG, guildId);
  }

  userSession(userId: string | number): string {
    return this.build(this.prefix, KEYS.USER_SESSION, userId);
  }

  commandUsage(guildId: string | number, command: string): string {
    return this.build(this.prefix, KEYS.COMMAND_USAGE, guildId, command);
  }

  // Rate limiting
  rateLimit(
    guildId: string | number,
    userId: string | number,
    command: string,
  ): string {
    return this.build(this.prefix, KEYS.RATE_LIMIT, guildId, userId, command);
  }

  // Locks
  lock(domain: string, resourceId: string): string {
    return this.build(this.prefix, KEYS.LOCK, domain, resourceId);
  }

  // Pub/Sub channels - generic: cb:pubsub:{domain} or cb:pubsub:{domain}:{channel}
  pubsub(domain: string, channel?: string): string {
    if (channel !== undefined) {
      return this.build(this.prefix, KEYS.PUBSUB, domain, channel);
    }
    return this.build(this.prefix, KEYS.PUBSUB, domain);
  }

  // Streams - generic: cb:stream:{domain}:{guildId}
  stream(domain: string, guildId?: string | number): string {
    if (guildId !== undefined) {
      return this.build(this.prefix, KEYS.STREAM, domain, guildId);
    }
    return this.build(this.prefix, KEYS.STREAM, domain);
  }

  // Stream DLQ - generic: cb:stream:{domain}:{guildId}:dlq
  streamDlq(domain: string, guildId?: string | number): string {
    if (guildId !== undefined) {
      return this.build(this.prefix, KEYS.STREAM, domain, guildId, KEYS.STREAM_DLQ);
    }
    return this.build(this.prefix, KEYS.STREAM, domain, KEYS.STREAM_DLQ);
  }

  // Audit log keys - generic: cb:auditlog:{guildId}:{subkey}
  auditLog(guildId: string | number, subkey: string): string {
    return this.build(this.prefix, KEYS.AUDIT_LOG, guildId, subkey);
  }

  auditLogLastEntryId(guildId: string | number): string {
    return this.auditLog(guildId, 'lastEntryId');
  }

  auditLogProcessedEntryId(guildId: string | number, entryId: string): string {
    return this.auditLog(guildId, `processed:${entryId}`);
  }
}

/**
 * Creates a ValkeyKeys builder with the given config.
 */
export function createValkeyKeys(config: ValkeyConfig): ValkeyKeys {
  return new ValkeyKeys(config);
}