// Leaderboard Stream Consumer - processes leaderboard update events from Valkey Streams
// Simplified version of MusicStreamConsumer — single stream, no per-guild sharding

import { getValkeyClient } from "../valkey";
import {
  createLeaderboardStreamKeys,
  createLeaderboardConsumerId,
  LEADERBOARD_STREAM_CONFIG,
  LEADERBOARD_STREAMS_EVENTS,
  type LeaderboardStreamEvent,
  type LeaderboardUpdateData,
} from "@charlybot/shared";
import { loadValkeyConfig } from "@charlybot/shared";
import logger from "../../utils/logger";
import LeaderboardService from "../../app/services/economy/LeaderboardService";

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let loopInFlight = false;

const consumerId = createLeaderboardConsumerId();
const config = loadValkeyConfig();
const keys = createLeaderboardStreamKeys(config.env ?? "development");

async function processLoop(): Promise<void> {
  if (!isRunning) return;
  if (loopInFlight) return;
  loopInFlight = true;

  const valkey = getValkeyClient();
  if (!valkey.isConnected()) {
    loopInFlight = false;
    return;
  }

  try {
    // Create consumer group (idempotent)
    await valkey.streamCreateGroup(keys.stream, keys.consumerGroup, "$");

    const entries = await valkey.streamReadGroup(
      keys.stream,
      keys.consumerGroup,
      consumerId,
      LEADERBOARD_STREAM_CONFIG.BATCH_SIZE,
      LEADERBOARD_STREAM_CONFIG.BLOCK_MS
    );

    for (const entry of entries) {
      let retryCount = 0;
      try {
        const payload = JSON.parse(entry.fields.payload ?? "{}");
        const event = payload as LeaderboardStreamEvent;

        if (event.type === LEADERBOARD_STREAMS_EVENTS.UPDATE) {
          await LeaderboardService.processUpdate(
            event.data.userId,
            event.data.guildId,
            event.data.username
          );
        }

        await valkey.streamAck(keys.stream, keys.consumerGroup, [entry.id]);
      } catch (error) {
        retryCount = parseInt(entry.fields._retryCount ?? "0") + 1;
        logger.error(
          {
            entryId: entry.id,
            retryCount,
            error: error instanceof Error ? error.message : String(error),
          },
          "Leaderboard consumer: failed to process event"
        );

        if (retryCount >= LEADERBOARD_STREAM_CONFIG.MAX_RETRIES) {
          // Move to DLQ
          await valkey.streamAdd(
            keys.dlq,
            {
              ...entry.fields,
              _retryCount: String(retryCount),
              _error: error instanceof Error ? error.message : String(error),
              _failedAt: String(Date.now()),
            },
            LEADERBOARD_STREAM_CONFIG.MAX_LEN
          );
          await valkey.streamAck(keys.stream, keys.consumerGroup, [entry.id]);
        }
        // If not max retries, don't ACK — it will be retried on next loop
      }
    }
  } catch (error) {
    if (isRunning) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Leaderboard consumer: loop error"
      );
    }
  } finally {
    loopInFlight = false;
  }
}

export async function startLeaderboardStreamConsumer(): Promise<void> {
  if (isRunning) return;

  const valkey = getValkeyClient();
  if (!valkey.isConnected()) {
    logger.warn(
      "LeaderboardStreamConsumer: Valkey not connected, deferring start"
    );
    return;
  }

  isRunning = true;
  logger.info(
    { consumerId, stream: keys.stream },
    "LeaderboardStreamConsumer started"
  );

  // Process loop every 2 seconds
  intervalId = setInterval(processLoop, 2000);
}

export async function stopLeaderboardStreamConsumer(): Promise<void> {
  isRunning = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  logger.info("LeaderboardStreamConsumer stopped");
}
