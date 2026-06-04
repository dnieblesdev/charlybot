import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";
import type { IAntiSpamAction, IAntiSpamConfig } from "@charlybot/shared/schemas/antispam";

export const ANTI_SPAM_CONFIG_CACHE_TTL_MS = 60_000;

export const DEFAULT_ANTI_SPAM_PATTERN_ACTIONS = {
  burst: "warn",
  duplicate: "warn",
  mention: "timeout_5min",
  link: "timeout_5min",
  caps: "warn",
  emoji: "warn",
  combo: "timeout_5min",
} as const satisfies Record<string, IAntiSpamAction>;

interface AntiSpamConfigCacheEntry {
  expiresAt: number;
  value: IAntiSpamConfig | null;
}

const antiSpamConfigCache = new Map<string, AntiSpamConfigCacheEntry>();

function toAntiSpamConfig(config: NonNullable<Awaited<ReturnType<typeof prisma.antiSpamConfig.findUnique>>>): IAntiSpamConfig {
  return {
    id: config.id,
    guildId: config.guildId,
    enabled: config.enabled,
    burstEnabled: config.burstEnabled,
    duplicateEnabled: config.duplicateEnabled,
    mentionEnabled: config.mentionEnabled,
    linkEnabled: config.linkEnabled,
    capsEnabled: config.capsEnabled,
    emojiEnabled: config.emojiEnabled,
    comboEnabled: config.comboEnabled,
    burstAction: config.burstAction as IAntiSpamConfig["burstAction"],
    duplicateAction: config.duplicateAction as IAntiSpamConfig["duplicateAction"],
    mentionAction: config.mentionAction as IAntiSpamConfig["mentionAction"],
    linkAction: config.linkAction as IAntiSpamConfig["linkAction"],
    capsAction: config.capsAction as IAntiSpamConfig["capsAction"],
    emojiAction: config.emojiAction as IAntiSpamConfig["emojiAction"],
    comboAction: config.comboAction as IAntiSpamConfig["comboAction"],
    escalationEnabled: config.escalationEnabled,
    escalationCount: config.escalationCount,
    notifyOnSpam: config.notifyOnSpam,
    createdAt: config.createdAt ?? undefined,
    updatedAt: config.updatedAt ?? undefined,
  };
}

function setCachedConfig(guildId: string, value: IAntiSpamConfig | null): void {
  antiSpamConfigCache.set(guildId, {
    expiresAt: Date.now() + ANTI_SPAM_CONFIG_CACHE_TTL_MS,
    value,
  });
}

export function invalidate(guildId: string): void {
  antiSpamConfigCache.delete(guildId);
}

export async function getCachedByGuildId(
  guildId: string,
): Promise<IAntiSpamConfig | null> {
  const cached = antiSpamConfigCache.get(guildId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const config = await getByGuildId(guildId);
  setCachedConfig(guildId, config);
  return config;
}

/**
 * Get anti-spam configuration for a guild.
 * Returns null if not found — caller handles defaults.
 */
export async function getByGuildId(
  guildId: string,
): Promise<IAntiSpamConfig | null> {
  try {
    const config = await prisma.antiSpamConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return null;
    }

    return toAntiSpamConfig(config);
  } catch (error) {
    logger.error("Error getting AntiSpamConfig by guildId", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
    });
    throw error;
  }
}

/**
 * Create a new anti-spam configuration with defaults for missing fields.
 */
export async function create(
  data: Partial<IAntiSpamConfig>,
): Promise<IAntiSpamConfig> {
  if (!data.guildId) {
    throw new Error("guildId is required to create AntiSpamConfig");
  }

  try {
    const config = await prisma.antiSpamConfig.create({
      data: {
        guildId: data.guildId,
        enabled: data.enabled ?? true,
        burstEnabled: data.burstEnabled ?? true,
        duplicateEnabled: data.duplicateEnabled ?? true,
        mentionEnabled: data.mentionEnabled ?? true,
        linkEnabled: data.linkEnabled ?? true,
        capsEnabled: data.capsEnabled ?? true,
        emojiEnabled: data.emojiEnabled ?? false,
        comboEnabled: data.comboEnabled ?? false,
        burstAction: data.burstAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.burst,
        duplicateAction: data.duplicateAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.duplicate,
        mentionAction: data.mentionAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.mention,
        linkAction: data.linkAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.link,
        capsAction: data.capsAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.caps,
        emojiAction: data.emojiAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.emoji,
        comboAction: data.comboAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.combo,
        escalationEnabled: data.escalationEnabled ?? true,
        escalationCount: data.escalationCount ?? 3,
        notifyOnSpam: data.notifyOnSpam ?? true,
      },
    });

    logger.info("AntiSpamConfig created", { guildId: config.guildId });

    const mappedConfig = toAntiSpamConfig(config);
    setCachedConfig(config.guildId, mappedConfig);
    return mappedConfig;
  } catch (error) {
    logger.error("Error creating AntiSpamConfig", {
      error: error instanceof Error ? error.message : String(error),
      guildId: data.guildId,
    });
    throw error;
  }
}

/**
 * Update an existing anti-spam configuration.
 * If config doesn't exist, creates it first (upsert behavior).
 */
export async function update(
  guildId: string,
  data: Partial<IAntiSpamConfig>,
): Promise<IAntiSpamConfig> {
  try {
    const updateData: Record<string, unknown> = {};

    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.burstEnabled !== undefined) updateData.burstEnabled = data.burstEnabled;
    if (data.duplicateEnabled !== undefined) updateData.duplicateEnabled = data.duplicateEnabled;
    if (data.mentionEnabled !== undefined) updateData.mentionEnabled = data.mentionEnabled;
    if (data.linkEnabled !== undefined) updateData.linkEnabled = data.linkEnabled;
    if (data.capsEnabled !== undefined) updateData.capsEnabled = data.capsEnabled;
    if (data.emojiEnabled !== undefined) updateData.emojiEnabled = data.emojiEnabled;
    if (data.comboEnabled !== undefined) updateData.comboEnabled = data.comboEnabled;
    if (data.burstAction !== undefined) updateData.burstAction = data.burstAction;
    if (data.duplicateAction !== undefined) updateData.duplicateAction = data.duplicateAction;
    if (data.mentionAction !== undefined) updateData.mentionAction = data.mentionAction;
    if (data.linkAction !== undefined) updateData.linkAction = data.linkAction;
    if (data.capsAction !== undefined) updateData.capsAction = data.capsAction;
    if (data.emojiAction !== undefined) updateData.emojiAction = data.emojiAction;
    if (data.comboAction !== undefined) updateData.comboAction = data.comboAction;
    if (data.escalationEnabled !== undefined) updateData.escalationEnabled = data.escalationEnabled;
    if (data.escalationCount !== undefined) updateData.escalationCount = data.escalationCount;
    if (data.notifyOnSpam !== undefined) updateData.notifyOnSpam = data.notifyOnSpam;

    const config = await prisma.antiSpamConfig.upsert({
      where: { guildId },
      update: updateData,
      create: {
        guildId,
        enabled: data.enabled ?? true,
        burstEnabled: data.burstEnabled ?? true,
        duplicateEnabled: data.duplicateEnabled ?? true,
        mentionEnabled: data.mentionEnabled ?? true,
        linkEnabled: data.linkEnabled ?? true,
        capsEnabled: data.capsEnabled ?? true,
        emojiEnabled: data.emojiEnabled ?? false,
        comboEnabled: data.comboEnabled ?? false,
        burstAction: data.burstAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.burst,
        duplicateAction: data.duplicateAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.duplicate,
        mentionAction: data.mentionAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.mention,
        linkAction: data.linkAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.link,
        capsAction: data.capsAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.caps,
        emojiAction: data.emojiAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.emoji,
        comboAction: data.comboAction ?? DEFAULT_ANTI_SPAM_PATTERN_ACTIONS.combo,
        escalationEnabled: data.escalationEnabled ?? true,
        escalationCount: data.escalationCount ?? 3,
        notifyOnSpam: data.notifyOnSpam ?? true,
      },
    });

    logger.info("AntiSpamConfig updated", { guildId, fields: Object.keys(updateData) });

    const mappedConfig = toAntiSpamConfig(config);
    setCachedConfig(guildId, mappedConfig);
    return mappedConfig;
  } catch (error) {
    logger.error("Error updating AntiSpamConfig", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
      data,
    });
    throw error;
  }
}
