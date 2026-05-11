import type { Message } from "discord.js";
import { ValkeyClient } from "@charlybot/shared";
import { ANTI_SPAM_KEYS } from "@charlybot/shared";
import logger from "../../utils/logger.js";

// Niveles de escalado
export enum SpamLevel {
  NONE = 0,
  WARNING = 1, // delete + warn
  MUTE_5MIN = 2, // timeout 5 min
  MUTE_30MIN = 3, // timeout 30 min
  KICK = 4, // kick
}

export interface SpamCheckResult {
  isSpam: boolean;
  level: SpamLevel;
  reason: string;
}

// URL detection regex
const URL_REGEX = /https?:\/\//i;

export class AntiSpamService {
  // Umbrales configurables
  private readonly MESSAGE_THRESHOLD = 5; // 5 mensajes
  private readonly MESSAGE_WINDOW = 10; // en 10 segundos
  private readonly MENTION_THRESHOLD = 3;
  private readonly MENTION_WINDOW = 10;
  private readonly LINK_THRESHOLD = 3;
  private readonly LINK_WINDOW = 30;
  private readonly DUPLICATE_WINDOW = 30; // mismo mensaje en 30s
  private readonly CAPS_RATIO = 0.7; // 70% mayúsculas
  private readonly CAPS_MIN_LENGTH = 10; // mínimo 10 caracteres

  constructor(private valkey: ValkeyClient) {}

  /**
   * Evalúa un mensaje contra todas las reglas anti-spam.
   * Retorna el nivel más alto encontrado.
   */
  async evaluate(message: Message): Promise<SpamCheckResult> {
    if (!message.guildId) {
      return { isSpam: false, level: SpamLevel.NONE, reason: "" };
    }

    // Run all checks in parallel
    const results = await Promise.allSettled([
      this.checkMessageRateLimit(message),
      this.checkMentionSpam(message),
      this.checkLinkSpam(message),
      this.checkDuplicateContent(message),
      this.checkCapsSpam(message),
    ]);

    // Find the highest level result
    let highest: SpamCheckResult = {
      isSpam: false,
      level: SpamLevel.NONE,
      reason: "",
    };

    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn("AntiSpam check failed, failing open", {
          error: result.reason,
          guildId: message.guildId,
          userId: message.author.id,
        });
        continue;
      }

      if (result.value.isSpam && result.value.level > highest.level) {
        highest = result.value;
      }
    }

    return highest;
  }

  /**
   * Rate limit de mensajes por usuario.
   */
  private async checkMessageRateLimit(
    message: Message,
  ): Promise<SpamCheckResult> {
    const key = ANTI_SPAM_KEYS.userMessages(message.guildId!, message.author.id);
    try {
      const allowed = await this.valkey.rateLimit(
        key,
        this.MESSAGE_THRESHOLD,
        this.MESSAGE_WINDOW,
      );
      if (!allowed) {
        return {
          isSpam: true,
          level: SpamLevel.WARNING,
          reason: `Rate limit: ${this.MESSAGE_THRESHOLD} msgs en ${this.MESSAGE_WINDOW}s`,
        };
      }
    } catch (err) {
      logger.warn("Valkey rateLimit failed for user messages, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, level: SpamLevel.NONE, reason: "" };
  }

  /**
   * Detección de menciones masivas.
   */
  private async checkMentionSpam(message: Message): Promise<SpamCheckResult> {
    const mentionCount = message.mentions.users.size;
    if (mentionCount >= this.MENTION_THRESHOLD) {
      const mentionKey = ANTI_SPAM_KEYS.userMentions(
        message.guildId!,
        message.author.id,
      );
      try {
        const mentionOk = await this.valkey.rateLimit(
          mentionKey,
          this.MENTION_THRESHOLD,
          this.MENTION_WINDOW,
        );
        if (!mentionOk) {
          return {
            isSpam: true,
            level: SpamLevel.MUTE_5MIN,
            reason: `Menciones masivas: ${mentionCount} usuarios`,
          };
        }
      } catch (err) {
        logger.warn("Valkey rateLimit failed for mentions, failing open", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { isSpam: false, level: SpamLevel.NONE, reason: "" };
  }

  /**
   * Detección de link spam.
   */
  private async checkLinkSpam(message: Message): Promise<SpamCheckResult> {
    const content = message.content;
    if (!URL_REGEX.test(content)) {
      return { isSpam: false, level: SpamLevel.NONE, reason: "" };
    }

    const linkKey = ANTI_SPAM_KEYS.userLinks(
      message.guildId!,
      message.author.id,
    );
    try {
      const linkOk = await this.valkey.rateLimit(
        linkKey,
        this.LINK_THRESHOLD,
        this.LINK_WINDOW,
      );
      if (!linkOk) {
        return {
          isSpam: true,
          level: SpamLevel.MUTE_5MIN,
          reason: `Link spam: ${this.LINK_THRESHOLD} links en ${this.LINK_WINDOW}s`,
        };
      }
    } catch (err) {
      logger.warn("Valkey rateLimit failed for links, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, level: SpamLevel.NONE, reason: "" };
  }

  /**
   * Detección de mensajes duplicados (mismo contenido en ventana corta).
   */
  private async checkDuplicateContent(
    message: Message,
  ): Promise<SpamCheckResult> {
    const content = message.content.trim();
    if (!content) {
      return { isSpam: false, level: SpamLevel.NONE, reason: "" };
    }

    // Simple hash: use the content itself as key (Valkey handles it)
    const dupKey = ANTI_SPAM_KEYS.userDuplicates(message.guildId!, message.author.id, this.hashContent(content));

    try {
      const exists = await this.valkey.get<string>(dupKey);
      if (exists) {
        return {
          isSpam: true,
          level: SpamLevel.MUTE_5MIN,
          reason: "Mensaje duplicado detectado",
        };
      }
      // Store the content hash with TTL
      await this.valkey.set<string>(dupKey, "1", this.DUPLICATE_WINDOW);
    } catch (err) {
      logger.warn("Valkey duplicate check failed, failing open", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { isSpam: false, level: SpamLevel.NONE, reason: "" };
  }

  /**
   * Detección de caps spam (demasiadas mayúsculas).
   */
  private checkCapsSpam(message: Message): SpamCheckResult {
    const content = message.content;
    if (content.length < this.CAPS_MIN_LENGTH) {
      return { isSpam: false, level: SpamLevel.NONE, reason: "" };
    }

    const upperCount = content.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "").length;
    const alphaCount = content.replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñüÜ]/g, "").length;

    if (alphaCount === 0) {
      return { isSpam: false, level: SpamLevel.NONE, reason: "" };
    }

    const ratio = upperCount / alphaCount;
    if (ratio > this.CAPS_RATIO) {
      return {
        isSpam: true,
        level: SpamLevel.WARNING,
        reason: `Caps spam: ${Math.round(ratio * 100)}% mayúsculas`,
      };
    }

    return { isSpam: false, level: SpamLevel.NONE, reason: "" };
  }

  /**
   * Simple content hash for duplicate detection.
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
