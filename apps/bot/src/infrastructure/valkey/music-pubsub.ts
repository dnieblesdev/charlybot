// Music pub/sub events - Valkey pub/sub integration
// Follows SDD design: Phase 4 - pub/sub v1 (best-effort)
// Uses cb:pubsub:music:{guildId} per spec

import { getValkeyClient } from "../valkey";
import { createValkeyKeys, loadValkeyConfig } from "@charlybot/shared";
import logger from "../../utils/logger";

// Channel naming: cb:pubsub:music:{guildId} per spec
export const MUSIC_CHANNELS = {
  getChannel: (guildId: string) => {
    const config = loadValkeyConfig();
    const keys = createValkeyKeys(config);
    return keys.pubsub('music', guildId);
  },
} as const;

// Event types
export interface MusicQueueEvent {
  type: 'song_added' | 'song_removed' | 'playback_started' | 'playback_stopped' | 'playback_paused' | 'queue_cleared';
  guildId: string;
  data: {
    songTitle?: string;
    queueLength?: number;
    position?: number;
  };
  timestamp: string;
}

/**
 * Publish a music event to the channel
 * Fire-and-forget (best-effort)
 */
export async function publishMusicEvent(event: MusicQueueEvent): Promise<void> {
  const channel = MUSIC_CHANNELS.getChannel(event.guildId);
  const valkey = getValkeyClient();

  try {
    await valkey.publish(channel, event);
  } catch (error) {
    logger.warn('Failed to publish music event', {
      channel,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    // Best-effort: silently drop
  }
}

/**
 * Subscribe to music events for a guild
 * Returns unsubscribe function
 */
export function subscribeMusicEvents(
  guildId: string,
  handler: (event: MusicQueueEvent) => void,
): () => void {
  const channel = MUSIC_CHANNELS.getChannel(guildId);
  const valkey = getValkeyClient();

  // Transform payload to MusicQueueEvent
  return valkey.subscribe(channel, (payload: object) => {
    const event = payload as MusicQueueEvent;
    handler(event);
  });
}
