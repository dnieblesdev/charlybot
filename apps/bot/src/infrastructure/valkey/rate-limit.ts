// Bot command rate limiting helper
// Uses Valkey for distributed rate limiting with fail-open semantics

import type { ChatInputCommandInteraction } from "discord.js";
import {
  BOT_COMMAND_RATE_LIMITS,
  TTL,
} from "@charlybot/shared";
import { getValkeyClient } from "./index";
import { createValkeyKeys, loadValkeyConfig } from "@charlybot/shared";

/**
 * Rate limit result
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Check if a command is rate limited for a user in a guild.
 * Uses fail-open: if Valkey fails, allows the request.
 */
export async function checkCommandRateLimit(
  guildId: string,
  userId: string,
  commandName: string,
): Promise<RateLimitResult> {
  const config = BOT_COMMAND_RATE_LIMITS[commandName];

  // If no rate limit configured for this command, allow
  if (!config) {
    return {
      allowed: true,
      remaining: -1,
      resetAt: 0,
      retryAfterSeconds: 0,
    };
  }

  const [limit, windowSeconds] = config;
  const valkeyConfig = loadValkeyConfig();
  const keys = createValkeyKeys(valkeyConfig);
  const key = keys.rateLimit(guildId, userId, commandName);

  try {
    const valkey = getValkeyClient();

    // Use rateLimit method from ValkeyClient
    const allowed = await valkey.rateLimit(key, limit, windowSeconds);

    if (allowed) {
      // Get current count for remaining
      const countResult = await valkey.get<number>(key);
      const currentCount = countResult ?? 0;

      return {
        allowed: true,
        remaining: Math.max(0, limit - currentCount - 1),
        resetAt: Date.now() + windowSeconds * 1000,
        retryAfterSeconds: 0,
      };
    } else {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + windowSeconds * 1000,
        retryAfterSeconds: windowSeconds,
      };
    }
  } catch {
    // Fail-open: if Valkey fails, allow the request
    return {
      allowed: true,
      remaining: -1,
      resetAt: 0,
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Rate limit a command interaction. Returns true if allowed, false if rate limited.
 * If denied, edits the reply with a cooldown message.
 */
export async function rateLimitCommand(
  interaction: ChatInputCommandInteraction,
  commandName: string,
): Promise<boolean> {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // DM commands don't need rate limiting
  if (!guildId) {
    return true;
  }

  const result = await checkCommandRateLimit(guildId, userId, commandName);

  if (!result.allowed) {
    const minutes = Math.ceil(result.retryAfterSeconds / 60);
    const seconds = result.retryAfterSeconds % 60;

    let cooldownMessage: string;
    if (minutes > 0) {
      cooldownMessage = `⏰ Estás ratelimitado. Intenta de nuevo en **${minutes}m ${seconds}s**`;
    } else {
      cooldownMessage = `⏰ Estás ratelimitado. Intenta de nuevo en **${seconds}s**`;
    }

    await interaction.editReply({ content: cooldownMessage });
    return false;
  }

  return true;
}

/**
 * Get the remaining cooldown time for a command in a human-readable format
 */
export function formatCooldown(remainingMs: number): string {
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.ceil((remainingMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}