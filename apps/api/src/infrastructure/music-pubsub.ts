// Music pub/sub subscription for API
// Follows SDD design: Phase 5 - real subscription implementation

import { getValkeyClient } from "./valkey";
import {
  createValkeyKeys,
  loadValkeyConfig,
  type ValkeyKeys,
} from "@charlybot/shared";
import logger from "../utils/logger";

export interface MusicQueueEvent {
  type:
    | "song_added"
    | "song_removed"
    | "playback_started"
    | "playback_stopped"
    | "playback_paused"
    | "queue_cleared";
  guildId: string;
  data: {
    songTitle?: string;
    queueLength?: number;
    position?: number;
  };
  timestamp: string;
}

// Singleton keys builder
let keysBuilder: ValkeyKeys;

function getKeys(): ValkeyKeys {
  if (!keysBuilder) {
    const config = loadValkeyConfig();
    keysBuilder = createValkeyKeys(config);
  }
  return keysBuilder;
}

/**
 * Subscribe to music events for a guild
 *
 * Real implementation using Valkey pub/sub:
 * - Channel: cb:pubsub:music:{guildId}
 * - Uses valkey.subscribe() with payload transformation
 * - Returns unsubscribe function
 */
export function subscribeMusicEvents(
  guildId: string,
  handler: (event: MusicQueueEvent) => void
): () => void {
  const keys = getKeys();
  const channel = keys.pubsub("music", guildId);
  const valkey = getValkeyClient();

  // Use real subscription via ValkeyClient
  const unsubscribe = valkey.subscribe(channel, (payload: object) => {
    try {
      const event = payload as MusicQueueEvent;
      handler(event);
    } catch (error) {
      logger.warn(
        {
          channel,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to transform pubsub message to MusicQueueEvent"
      );
    }
  });

  logger.info({ guildId, channel }, "Music event subscription started");

  // Return combined unsubscribe: cleanup + real unsub
  return () => {
    unsubscribe();
    logger.info({ guildId, channel }, "Music event subscription stopped");
  };
}

/**
 * Publish a music event (for API to notify external systems)
 */
export async function publishMusicEvent(event: MusicQueueEvent): Promise<void> {
  const keys = getKeys();
  const channel = keys.pubsub("music", event.guildId);
  const valkey = getValkeyClient();

  try {
    await valkey.publish(channel, event);
  } catch (error) {
    logger.warn(
      {
        channel,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to publish music event"
    );
  }
}
