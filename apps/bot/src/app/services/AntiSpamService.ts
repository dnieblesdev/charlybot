import type { Message, GuildMember } from "discord.js";
import type { IAntiSpamConfig, IAntiSpamPattern } from "@charlybot/shared/schemas/antispam";
import type { IValkeyClient } from "@charlybot/shared";
import { ANTI_SPAM_KEYS } from "@charlybot/shared";
import logger from "../../utils/logger.js";
import * as historyRepo from "../../config/repositories/AntiSpamHistoryRepo.js";
import { AntiSpamAction, toAntiSpamAction, type SpamCheckResult } from "./SpamCheckResult.js";

// URL detection regex
const URL_REGEX = /https?:\/\//i;

// Basic emoji range (emoticons)
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]/gu;

// Mention detection (any @user reference)
const MENTION_REGEX = /<@\d+>/;

/**
 * Hardcoded defaults for backward compatibility when config is null.
 */
const DEFAULTS = {
  MESSAGE_THRESHOLD: 5,
  MESSAGE_WINDOW: 10,
  MENTION_THRESHOLD: 3,
  MENTION_WINDOW: 10,
  LINK_THRESHOLD: 3,
  LINK_WINDOW: 30,
  DUPLICATE_WINDOW: 30,
  CAPS_RATIO: 0.7,
  CAPS_MIN_LENGTH: 10,
  BURST_THRESHOLD: 3,
  BURST_WINDOW: 5,
  EMOJI_THRESHOLD: 2,
  EMOJI_WINDOW: 10,
  EMOJI_COUNT: 5,
  COMBO_THRESHOLD: 2,
  COMBO_WINDOW: 10,
  VELOCITY_THRESHOLD_MS: 1000,
  ESCALATION_LOOKBACK_HOURS: 1,
} as const;

export class AntiSpamService {
  private config: IAntiSpamConfig | null = null;

  constructor(
    private valkey: IValkeyClient,
    config?: IAntiSpamConfig | null,
  ) {
    this.config = config ?? null;
  }

  /**
   * Evaluate a message against all enabled anti-spam patterns.
   * Returns the first detected spam result (not the highest) with pattern name and action.
   *
   * Uses a per-user distributed lock to prevent race conditions when multiple
   * messages from the same user arrive simultaneously.
   */
  async evaluate(message: Message): Promise<SpamCheckResult> {
    if (!message.guildId) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    if (this.config && !this.config.enabled) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    // First-trigger guard: if an action was already taken for this user recently,
    // skip evaluation to prevent duplicate sanctions on burst messages.
    const actionTakenKey = `cb:antispam:${message.guildId}:${message.author.id}:actionTaken`;
    try {
      const alreadyActed = await this.valkey.get<string>(actionTakenKey);
      if (alreadyActed) {
        // Action already taken for this user recently — skip to avoid duplicate warns/timeouts
        return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
      }
    } catch {
      // fail-open: continue evaluation if Valkey check fails
    }

    const checks: Promise<SpamCheckResult>[] = [];

    // Rate limit (message burst across channels) — maps to burst pattern
    if (this.isEnabled("burstEnabled")) {
      checks.push(this.checkRateLimit(message));
    }

    // Burst per channel
    if (this.isEnabled("burstEnabled")) {
      checks.push(this.checkBurstPerChannel(message));
    }

    // Extreme velocity
    if (this.isEnabled("burstEnabled")) {
      checks.push(this.checkVelocity(message));
    }

    // Mention spam
    if (this.isEnabled("mentionEnabled")) {
      checks.push(this.checkMentionSpam(message));
    }

    // Link spam
    if (this.isEnabled("linkEnabled")) {
      checks.push(this.checkLinkSpam(message));
    }

    // Duplicate content
    if (this.isEnabled("duplicateEnabled")) {
      checks.push(this.checkDuplicateContent(message));
    }

    // Caps spam (sync, no Promise)
    if (this.isEnabled("capsEnabled")) {
      checks.push(Promise.resolve(this.checkCapsSpam(message)));
    }

    // Emoji spam
    if (this.isEnabled("emojiEnabled")) {
      checks.push(this.checkEmojiSpam(message));
    }

    // Mention + link combo
    if (this.isEnabled("comboEnabled")) {
      checks.push(this.checkCombo(message));
    }

    const results = await Promise.allSettled(checks);

    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn("AntiSpam check failed, failing open", {
          error: result.reason,
          guildId: message.guildId,
          userId: message.author.id,
        });
        continue;
      }

      if (result.value.isSpam) {
        // Mark that an action has been taken for this user to prevent
        // duplicate sanctions when multiple burst messages evaluate in parallel.
        try {
          await this.valkey.set(actionTakenKey, "1", DEFAULTS.MESSAGE_WINDOW);
        } catch {
          // fail-open: continue even if marking fails
        }
        return result.value;
      }
    }

    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  private isEnabled(field: keyof IAntiSpamConfig): boolean {
    if (!this.config) return true;
    const val = this.config[field];
    return typeof val === "boolean" ? val : true;
  }

  private getAction(
    actionField: keyof IAntiSpamConfig,
    fallback: AntiSpamAction,
  ): AntiSpamAction {
    if (!this.config) return fallback;
    const val = this.config[actionField];
    return typeof val === "string" ? toAntiSpamAction(val) : fallback;
  }

  private getEscalationCount(): number {
    return this.config?.escalationCount ?? 3;
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: rate limit (cross-channel burst — existing behavior)
  // Pattern name: "rateLimit"
  // ─────────────────────────────────────────────────────────────
  private async checkRateLimit(message: Message): Promise<SpamCheckResult> {
    const threshold = DEFAULTS.MESSAGE_THRESHOLD;
    const window = DEFAULTS.MESSAGE_WINDOW;

    const key = ANTI_SPAM_KEYS.userMessages(message.guildId!, message.author.id);
    const now = Date.now();
    const member = `${message.id}:${message.channel.id}`;

    try {
      await this.valkey.sortedSetAdd(key, now, member);
      await this.valkey.sortedSetRemoveByScore(key, now - window * 1000);
      await this.valkey.expire(key, window);

      const members = await this.valkey.sortedSetRangeByScore(key, now - window * 1000, now);

      if (members.length >= threshold) {
        const messageIds: { id: string; channelId: string }[] = [];
        for (const m of members) {
          const [id, channelId] = m.split(":");
          if (id && channelId) {
            messageIds.push({ id, channelId });
          }
        }
        return {
          isSpam: true,
          pattern: "rateLimit",
          action: this.getAction("burstAction", AntiSpamAction.WARN),
          reason: `Rate limit: ${threshold} msgs en ${window}s`,
          messageIds,
        };
      }
    } catch (err) {
      logger.warn("Valkey rate limit check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: burst per channel
  // Key: cb:antispam:${guildId}:${userId}:burst:${channelId}
  // Threshold: 3+ messages in 5 seconds in SAME channel
  // ─────────────────────────────────────────────────────────────
  private async checkBurstPerChannel(message: Message): Promise<SpamCheckResult> {
    const threshold = DEFAULTS.BURST_THRESHOLD;
    const window = DEFAULTS.BURST_WINDOW;

    const key = `cb:antispam:${message.guildId}:${message.author.id}:burst:${message.channel.id}`;
    const now = Date.now();
    const member = `${message.id}:${message.channel.id}`;

    try {
      await this.valkey.sortedSetAdd(key, now, member);
      await this.valkey.sortedSetRemoveByScore(key, now - window * 1000);
      await this.valkey.expire(key, window);

      const members = await this.valkey.sortedSetRangeByScore(key, now - window * 1000, now);

      if (members.length >= threshold) {
        const messageIds: { id: string; channelId: string }[] = [];
        for (const m of members) {
          const [id, channelId] = m.split(":");
          if (id && channelId) {
            messageIds.push({ id, channelId });
          }
        }
        return {
          isSpam: true,
          pattern: "burst",
          action: this.getAction("burstAction", AntiSpamAction.WARN),
          reason: `Burst: ${members.length} msgs in channel in ${window}s`,
          messageIds,
        };
      }
    } catch (err) {
      logger.warn("Valkey burst-per-channel check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: extreme velocity
  // Key: cb:antispam:${guildId}:${userId}:velocity
  // Stores timestamp of last message. If current - last < 1000ms, trigger.
  // Uses burstAction as fallback (velocityAction not in config schema)
  // ─────────────────────────────────────────────────────────────
  private async checkVelocity(message: Message): Promise<SpamCheckResult> {
    const key = ANTI_SPAM_KEYS.userVelocity(message.guildId!, message.author.id);
    const now = Date.now();

    try {
      const lastStr = await this.valkey.get<string>(key);
      if (lastStr !== null) {
        const last = parseInt(lastStr as string, 10);
        if (!isNaN(last) && now - last < DEFAULTS.VELOCITY_THRESHOLD_MS) {
          return {
            isSpam: true,
            pattern: "velocity",
            action: this.getAction("burstAction", AntiSpamAction.WARN),
            reason: `Velocity: messages less than ${DEFAULTS.VELOCITY_THRESHOLD_MS}ms apart`,
          };
        }
      }
      // Store current timestamp
      await this.valkey.set(key, now.toString(), Math.ceil(DEFAULTS.VELOCITY_THRESHOLD_MS / 1000));
    } catch (err) {
      logger.warn("Valkey velocity check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: mention spam
  // ─────────────────────────────────────────────────────────────
  private async checkMentionSpam(message: Message): Promise<SpamCheckResult> {
    const mentionCount = message.mentions.users.size;
    if (mentionCount < DEFAULTS.MENTION_THRESHOLD) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    const mentionKey = ANTI_SPAM_KEYS.userMentions(message.guildId!, message.author.id);
    try {
      const mentionOk = await this.valkey.rateLimit(
        mentionKey,
        DEFAULTS.MENTION_THRESHOLD,
        DEFAULTS.MENTION_WINDOW,
      );
      if (!mentionOk) {
        return {
          isSpam: true,
          pattern: "mention",
          action: this.getAction("mentionAction", AntiSpamAction.TIMEOUT_5MIN),
          reason: `Mention spam: ${mentionCount} users`,
        };
      }
    } catch (err) {
      logger.warn("Valkey rateLimit failed for mentions, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: link spam
  // ─────────────────────────────────────────────────────────────
  private async checkLinkSpam(message: Message): Promise<SpamCheckResult> {
    const content = message.content;
    if (!URL_REGEX.test(content)) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    const linkKey = ANTI_SPAM_KEYS.userLinks(message.guildId!, message.author.id);
    try {
      const linkOk = await this.valkey.rateLimit(
        linkKey,
        DEFAULTS.LINK_THRESHOLD,
        DEFAULTS.LINK_WINDOW,
      );
      if (!linkOk) {
        return {
          isSpam: true,
          pattern: "link",
          action: this.getAction("linkAction", AntiSpamAction.TIMEOUT_5MIN),
          reason: `Link spam: ${DEFAULTS.LINK_THRESHOLD} links in ${DEFAULTS.LINK_WINDOW}s`,
        };
      }
    } catch (err) {
      logger.warn("Valkey rateLimit failed for links, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: duplicate content
  // ─────────────────────────────────────────────────────────────
  private async checkDuplicateContent(message: Message): Promise<SpamCheckResult> {
    const content = message.content.trim();
    if (!content) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    const dupKey = ANTI_SPAM_KEYS.userDuplicates(
      message.guildId!,
      message.author.id,
      this.hashContent(content),
    );

    try {
      const exists = await this.valkey.get<string>(dupKey);
      if (exists) {
        return {
          isSpam: true,
          pattern: "duplicate",
          action: this.getAction("duplicateAction", AntiSpamAction.WARN),
          reason: "Duplicate content detected",
        };
      }
      await this.valkey.set<string>(dupKey, "1", DEFAULTS.DUPLICATE_WINDOW);
    } catch (err) {
      logger.warn("Valkey duplicate check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: caps spam
  // ─────────────────────────────────────────────────────────────
  private checkCapsSpam(message: Message): SpamCheckResult {
    const content = message.content;
    if (content.length < DEFAULTS.CAPS_MIN_LENGTH) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    const upperCount = content.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "").length;
    const alphaCount = content.replace(/[^a-zA-ZÁÉÍÓáéíóúÑñüÜ]/g, "").length;

    if (alphaCount === 0) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    const ratio = upperCount / alphaCount;
    if (ratio > DEFAULTS.CAPS_RATIO) {
      return {
        isSpam: true,
        pattern: "caps",
        action: this.getAction("capsAction", AntiSpamAction.WARN),
        reason: `Caps spam: ${Math.round(ratio * 100)}% mayúsculas`,
      };
    }

    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: emoji spam
  // Key: cb:antispam:${guildId}:${userId}:emoji
  // Threshold: 2+ messages with 5+ emojis in 10 seconds
  // ─────────────────────────────────────────────────────────────
  private async checkEmojiSpam(message: Message): Promise<SpamCheckResult> {
    const content = message.content;
    const emojiCount = (content.match(EMOJI_REGEX) ?? []).length;

    if (emojiCount < DEFAULTS.EMOJI_COUNT) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    const key = ANTI_SPAM_KEYS.userEmoji(message.guildId!, message.author.id);
    const now = Date.now();
    const member = `${message.id}:${message.channel.id}`;

    try {
      await this.valkey.sortedSetAdd(key, now, member);
      await this.valkey.sortedSetRemoveByScore(key, now - DEFAULTS.EMOJI_WINDOW * 1000);
      await this.valkey.expire(key, DEFAULTS.EMOJI_WINDOW);

      const members = await this.valkey.sortedSetRangeByScore(
        key,
        now - DEFAULTS.EMOJI_WINDOW * 1000,
        now,
      );

      if (members.length >= DEFAULTS.EMOJI_THRESHOLD) {
        const messageIds = members
          .map((m) => {
            const [id, channelId] = m.split(":");
            if (!id || !channelId) return null;
            return { id, channelId };
          })
          .filter((item): item is { id: string; channelId: string } => item !== null);
        return {
          isSpam: true,
          pattern: "emoji",
          action: this.getAction("emojiAction", AntiSpamAction.WARN),
          reason: `Emoji spam: ${members.length} emoji msgs in ${DEFAULTS.EMOJI_WINDOW}s`,
          messageIds,
        };
      }
    } catch (err) {
      logger.warn("Valkey emoji spam check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  // ─────────────────────────────────────────────────────────────
  // Pattern: mention + link combo
  // Key: cb:antispam:${guildId}:${userId}:combo
  // Threshold: 2+ messages with both mention AND link in 10s
  // OR 3+ mentions + 1 link in single message
  // ─────────────────────────────────────────────────────────────
  private async checkCombo(message: Message): Promise<SpamCheckResult> {
    const content = message.content;
    const hasMention = MENTION_REGEX.test(content);
    const hasLink = URL_REGEX.test(content);

    if (!hasMention || !hasLink) {
      return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
    }

    // Single-message trigger: 3+ mentions + 1 link
    const mentionCount = (content.match(MENTION_REGEX) ?? []).length;
    if (mentionCount >= 3) {
      return {
        isSpam: true,
        pattern: "combo",
        action: this.getAction("comboAction", AntiSpamAction.TIMEOUT_5MIN),
        reason: `Combo: ${mentionCount} mentions + link in single message`,
      };
    }

    // Multi-message: track via sorted set
    const key = ANTI_SPAM_KEYS.userCombo(message.guildId!, message.author.id);
    const now = Date.now();
    const member = `${message.id}:${message.channel.id}`;

    try {
      await this.valkey.sortedSetAdd(key, now, member);
      await this.valkey.sortedSetRemoveByScore(key, now - DEFAULTS.COMBO_WINDOW * 1000);
      await this.valkey.expire(key, DEFAULTS.COMBO_WINDOW);

      const members = await this.valkey.sortedSetRangeByScore(
        key,
        now - DEFAULTS.COMBO_WINDOW * 1000,
        now,
      );

      if (members.length >= DEFAULTS.COMBO_THRESHOLD) {
        const messageIds = members
          .map((m) => {
            const [id, channelId] = m.split(":");
            if (!id || !channelId) return null;
            return { id, channelId };
          })
          .filter((item): item is { id: string; channelId: string } => item !== null);
        return {
          isSpam: true,
          pattern: "combo",
          action: this.getAction("comboAction", AntiSpamAction.TIMEOUT_5MIN),
          reason: `Combo: ${members.length} mention+link msgs in ${DEFAULTS.COMBO_WINDOW}s`,
          messageIds,
        };
      }
    } catch (err) {
      logger.warn("Valkey combo check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, pattern: "", action: AntiSpamAction.WARN, reason: "" };
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(36);
  }

  /**
   * Apply the configured action for a spam result.
   * Handles escalation based on recent history count.
   * Returns the final action that was applied.
   */
  async applyAction(
    result: SpamCheckResult,
    message: Message,
    member: GuildMember,
  ): Promise<{ action: AntiSpamAction; escalated: boolean }> {
    if (!result.isSpam || !message.guildId) {
      return { action: AntiSpamAction.WARN, escalated: false };
    }

    let action = result.action;

    // Escalation check
    if (this.config?.escalationEnabled) {
      const lookback = new Date(Date.now() - DEFAULTS.ESCALATION_LOOKBACK_HOURS * 60 * 60 * 1000);
      const recentCount = await historyRepo.countRecentByUser(
        message.guildId,
        message.author.id,
        lookback,
      );

      if (recentCount >= this.getEscalationCount()) {
        const escalated = this.escalateAction(action);
        if (escalated !== action) {
          logger.info("Escalating anti-spam action", {
            guildId: message.guildId,
            userId: message.author.id,
            pattern: result.pattern,
            from: action,
            to: escalated,
            recentCount,
          });
          action = escalated;
        }
      }
    }

    // Persist history record
    await historyRepo.create({
      guildId: message.guildId,
      userId: message.author.id,
      pattern: result.pattern as IAntiSpamPattern,
      action,
      reason: result.reason,
    });

    return { action, escalated: action !== result.action };
  }

  /**
   * Escalate an action per escalation rules.
   * warn → timeout_5min
   * timeout_5min → timeout_30min
   * timeout_30min → timeout_30min (max)
   */
  private escalateAction(action: AntiSpamAction): AntiSpamAction {
    switch (action) {
      case AntiSpamAction.WARN:
        return AntiSpamAction.TIMEOUT_5MIN;
      case AntiSpamAction.TIMEOUT_5MIN:
        return AntiSpamAction.TIMEOUT_30MIN;
      case AntiSpamAction.TIMEOUT_30MIN:
        return AntiSpamAction.TIMEOUT_30MIN;
      default:
        return action;
    }
  }
}