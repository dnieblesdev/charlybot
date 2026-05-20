// src/app/events/messageCreate.ts
import { Events, TextChannel, EmbedBuilder } from "discord.js";
import type { Message, GuildMember } from "discord.js";
import type { Client } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import * as XPRepo from "../../config/repositories/XPRepo";
import * as AntiSpamConfigRepo from "../../config/repositories/AntiSpamConfigRepo.ts";
import logger from "../../utils/logger.ts";
import { isValidImageAttachment } from "../../utils/attachmentValidator.ts";
import { AntiSpamService } from "../services/AntiSpamService.ts";
import * as ModCaseRepository from "../../config/repositories/modCaseRepository.ts";
import { logModAction } from "../services/ModLogService.ts";
import { getValkeyClient } from "../../infrastructure/valkey/index.ts";
import { ANTI_SPAM_KEYS } from "@charlybot/shared";
import { AntiSpamAction, type SpamCheckResult } from "../services/SpamCheckResult.ts";

const MOD_LOG_NOTIFY_TTL_SECONDS = 30;

async function notifySpamToModLog(
  client: Client,
  guildId: string,
  userId: string,
  spamResult: SpamCheckResult,
  member: GuildMember,
  actionsTaken: string[],
  actionsFailed: string[],
): Promise<void> {
  // ===== Task 2: Mod log deduplication (per pattern) =====
  const valkey = getValkeyClient();
  const notifiedKey = `${ANTI_SPAM_KEYS.userNotified(guildId, userId)}:${spamResult.pattern}`;
  try {
    const alreadyNotified = await valkey.get<string>(notifiedKey);
    if (alreadyNotified !== null) {
      // Already notified for this user recently — skip to avoid mod log spam
      return;
    }
    // Mark as notified before sending (prevents duplicate sends on crash)
    await valkey.set(notifiedKey, "1", MOD_LOG_NOTIFY_TTL_SECONDS);
  } catch (err) {
    logger.warn("Failed to set antispam notified key, will send anyway", {
      error: err instanceof Error ? err.message : String(err),
      guildId,
      userId,
    });
  }

  const guildConfig = await getGuildConfig(guildId);
  const modLogChannelId = guildConfig?.modLogChannelId;
  if (!modLogChannelId) return;

  const channel = await client.channels.fetch(modLogChannelId).catch(() => null);
  if (!channel || !("send" in channel)) return;

  const embed = new EmbedBuilder()
    .setTitle("Spam detectado")
    .setColor(0xff6600)
    .setDescription(`El usuario ${member.user.tag} fue detectado enviando spam.`)
    .addFields(
      { name: "Usuario", value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: "Razón", value: spamResult.reason, inline: true },
    )
    .setTimestamp();

  if (actionsTaken.length > 0) {
    embed.addFields({ name: "Acciones realizadas", value: actionsTaken.join("\n"), inline: false });
  }
  if (actionsFailed.length > 0) {
    embed.addFields({ name: "Acciones que no se pudieron realizar", value: actionsFailed.join("\n"), inline: false });
  }

  if (spamResult.messageIds && spamResult.messageIds.length > 0) {
    const channelCounts = new Map<string, number>();
    for (const m of spamResult.messageIds) {
      channelCounts.set(m.channelId, (channelCounts.get(m.channelId) || 0) + 1);
    }
    const channelInfo = Array.from(channelCounts.entries())
      .map(([channelId, count]) => `<#${channelId}>: ${count} mensaje(s)`)
      .join("\n");
    embed.addFields({ name: "Canales afectados", value: channelInfo, inline: false });
  }

  await channel.send({ embeds: [embed] }).catch((err) => {
    logger.warn("No se pudo enviar notificación de spam al canal de mod", {
      error: err instanceof Error ? err.message : String(err),
      guildId,
      channelId: modLogChannelId,
    });
  });
}

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot) return;
    const guildId = message.guild?.id;
    if (!guildId) return;

    // ========== ANTI-SPAM CHECK ==========
    let spamResult: SpamCheckResult | null = null;
    let antiSpam: AntiSpamService | null = null;
    let antiSpamConfig: Awaited<ReturnType<typeof AntiSpamConfigRepo.getByGuildId>> = null;

    // Task 1: Load config BEFORE evaluating spam
    try {
      antiSpamConfig = await AntiSpamConfigRepo.getByGuildId(guildId);
      // antispamEnabled is true by default (null/undefined means enabled)
      if (antiSpamConfig?.enabled !== false) {
        const valkey = getValkeyClient();
        antiSpam = new AntiSpamService(valkey, antiSpamConfig);
        spamResult = await antiSpam.evaluate(message);
      }
      // If enabled === false, skip silently — antiSpam stays null, spamResult stays null
    } catch (err) {
      logger.error("Falló la evaluación anti spam, continuando sin bloquear", {
        error: err instanceof Error ? err.message : String(err),
        guildId,
        userId: message.author.id,
      });
    }

    if (spamResult?.isSpam) {
      const member = message.member;
      const actionsTaken: string[] = [];
      const actionsFailed: string[] = [];
      let modCase;

      // 1. Determine final action (with escalation) BEFORE deleting messages
      let finalAction = spamResult.action;
      if (member && antiSpam) {
        try {
          const result = await antiSpam.applyAction(spamResult, message, member);
          finalAction = result.action;
        } catch (err) {
          logger.error("Error al aplicar escalado anti spam", {
            error: err instanceof Error ? err.message : String(err),
            guildId,
            userId: message.author.id,
          });
        }
      }

      // 2. Delete messages — skipped for NOTIFY_ONLY per spec
      if (finalAction !== AntiSpamAction.NOTIFY_ONLY) {
        if (spamResult.messageIds && spamResult.messageIds.length > 0) {
          // Bulk delete all burst messages
          const deletePromises = spamResult.messageIds.map(async (msg) => {
            try {
              const channel = message.client.channels.cache.get(msg.channelId)
                || await message.client.channels.fetch(msg.channelId).catch(() => null);
              if (!channel) {
                logger.warn("No se encontró el canal para borrar mensaje de spam", {
                  messageId: msg.id,
                  channelId: msg.channelId,
                });
                return;
              }
              if (!("messages" in channel)) {
                logger.warn("El canal no soporta mensajes (posiblemente es un DM o voz)", {
                  messageId: msg.id,
                  channelId: msg.channelId,
                  channelType: (channel as any).type,
                });
                return;
              }
              const msgObj = await channel.messages.fetch(msg.id).catch((err) => {
                logger.debug("No se pudo obtener el mensaje para borrar", {
                  messageId: msg.id,
                  channelId: msg.channelId,
                  error: err instanceof Error ? err.message : String(err),
                });
                return null;
              });
              if (!msgObj) {
                logger.warn("Mensaje no encontrado (ya fue borrado o no accesible)", {
                  messageId: msg.id,
                  channelId: msg.channelId,
                });
                return;
              }
              await msgObj.delete();
            } catch (err) {
              logger.error("Error inesperado al borrar mensaje de spam", {
                messageId: msg.id,
                channelId: msg.channelId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          });
          await Promise.allSettled(deletePromises);
        } else {
          // Patterns without messageIds tracking — delete only the current message
          try {
            await message.delete();
          } catch (err) {
            logger.debug("No se pudo borrar mensaje de spam (current)", {
              messageId: message.id,
              channelId: message.channel.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // 3. Apply sanctions
      if (member) {
        try {
          switch (finalAction) {
            case AntiSpamAction.WARN: {
              modCase = await ModCaseRepository.create({
                guildId,
                userId: message.author.id,
                moderatorId: "SYSTEM",
                type: "warn",
                reason: `[Auto-mod] ${spamResult.reason}`,
              });
              actionsTaken.push("Advertencia registrada");
              break;
            }
            case AntiSpamAction.TIMEOUT_5MIN: {
              if (member.moderatable) {
                await member.timeout(5 * 60 * 1000, spamResult.reason);
                modCase = await ModCaseRepository.create({
                  guildId,
                  userId: message.author.id,
                  moderatorId: "SYSTEM",
                  type: "timeout",
                  reason: `[Auto-mod] ${spamResult.reason}`,
                  duration: BigInt(5 * 60 * 1000),
                });
                actionsTaken.push("Timeout de 5 minutos aplicado");
              } else {
                actionsFailed.push("No se pudo aplicar timeout de 5 minutos: el usuario tiene un rol igual o superior al del bot");
              }
              break;
            }
            case AntiSpamAction.TIMEOUT_30MIN: {
              if (member.moderatable) {
                await member.timeout(30 * 60 * 1000, spamResult.reason);
                modCase = await ModCaseRepository.create({
                  guildId,
                  userId: message.author.id,
                  moderatorId: "SYSTEM",
                  type: "timeout",
                  reason: `[Auto-mod] ${spamResult.reason}`,
                  duration: BigInt(30 * 60 * 1000),
                });
                actionsTaken.push("Timeout de 30 minutos aplicado");
              } else {
                actionsFailed.push("No se pudo aplicar timeout de 30 minutos: el usuario tiene un rol igual o superior al del bot");
              }
              break;
            }
            case AntiSpamAction.NOTIFY_ONLY: {
              // No sanctions, only mod log notification
              actionsTaken.push("Solo notificación (sin sanción)");
              break;
            }
            case AntiSpamAction.DELETE_ONLY: {
              // No sanctions, messages already deleted above
              actionsTaken.push("Solo eliminación de mensajes");
              break;
            }
            default: {
              // Exhaustiveness check
              modCase = await ModCaseRepository.create({
                guildId,
                userId: message.author.id,
                moderatorId: "SYSTEM",
                type: "warn",
                reason: `[Auto-mod] ${spamResult.reason}`,
              });
              actionsTaken.push("Advertencia registrada (default)");
              break;
            }
          }

          // Only log mod action and create ModCase for non-notify-only/delete-only actions
          if (finalAction !== AntiSpamAction.NOTIFY_ONLY && finalAction !== AntiSpamAction.DELETE_ONLY) {
            if (modCase) {
              await logModAction(
                message.client,
                guildId,
                modCase,
                "AutoMod",
                message.author.username,
              );
              actionsTaken.push("Caso registrado en el log de moderación");
            }
          }
        } catch (err) {
          logger.error("No se pudo ejecutar la acción de moderación anti spam", {
            error: err instanceof Error ? err.message : String(err),
            guildId,
            userId: message.author.id,
            pattern: spamResult.pattern,
          });
          actionsFailed.push(`Error al aplicar sanción: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 3. Notificar al canal de mod log (with dedup), solo si está habilitado
      if (member && antiSpamConfig?.notifyOnSpam !== false) {
        await notifySpamToModLog(
          message.client,
          guildId,
          message.author.id,
          spamResult,
          member,
          actionsTaken,
          actionsFailed,
        );
      }

      logger.info("Acción anti spam ejecutada", {
        pattern: spamResult.pattern,
        reason: spamResult.reason,
        guildId,
        userId: message.author.id,
        actionsTaken,
        actionsFailed,
      });

      // Don't continue to XP tracking for spam messages
      return;
    }
    // ========== END ANTI-SPAM ==========

    // ========== XP TRACKING (independiente de imágenes) ==========
    // No contar como XP mensajes de interacciones (comandos slash)
    if (message.interaction) return;
    
    // Early return silencioso si XP no está habilitado o no hay config
    let xpConfig;
    try {
      xpConfig = await XPRepo.getXPConfig(guildId);
    } catch {
      // Si la API falla o no hay config, early return silencioso
      return;
    }
    if (!xpConfig?.enabled) return;
    
    try {
      const userId = message.author.id;
      const userXP = await XPRepo.getUserXP(guildId, userId);

      // Rate limit: si el último mensaje fue hace menos de 5 segundos, skip
      let shouldTrack = true;
      if (userXP?.lastMessageAt) {
        const lastMessageTime = userXP.lastMessageAt instanceof Date
          ? userXP.lastMessageAt.getTime()
          : new Date(userXP.lastMessageAt).getTime();
        if (Date.now() - lastMessageTime < 5000) {
          shouldTrack = false;
        }
      }

      if (shouldTrack) {
        const previousXP = userXP?.xp || 0;
        const previousNivel = userXP?.nivel || 0;
        const xpIncrement = xpConfig.xpPerMessage;
        const newXP = previousXP + xpIncrement;
        // Mantiene la curva 100 * nivel^2 => nivel = floor(sqrt(xp / 100))
        const newNivel = Math.floor(Math.sqrt(newXP / 100));

        // Usar incremento atómico para evitar race conditions
        await XPRepo.incrementUserXP(guildId, userId, xpIncrement, newNivel, message.author.username);

        // Verificar si hubo level up
        if (newNivel > previousNivel) {
          logger.info("User leveled up", { userId, guildId, previousLevel: previousNivel, newLevel: newNivel, xp: newXP });

          const levelRoles = await XPRepo.getLevelRoles(guildId);
          if (levelRoles.length > 0 && message.member) {
            for (const levelRole of levelRoles) {
              if (levelRole.level <= newNivel) {
                try {
                  if (!message.member.roles.cache.has(levelRole.roleId)) {
                    await message.member.roles.add(levelRole.roleId);
                    logger.debug("Added level role to user", { userId, guildId, roleId: levelRole.roleId, level: levelRole.level });
                  }
                } catch (error) {
                  logger.error("Failed to add level role", { error: error instanceof Error ? error.message : String(error), userId, guildId, roleId: levelRole.roleId });
                }
              }
            }
          }

          // Enviar mensaje de level up si está configurado
          if (xpConfig.levelUpChannelId) {
            const levelUpChannel = message.guild?.channels.cache.get(xpConfig.levelUpChannelId);
            if (levelUpChannel && levelUpChannel instanceof TextChannel) {
              const messageText = xpConfig.levelUpMessage
                ? xpConfig.levelUpMessage.replace(/{user}/g, message.author.username).replace(/{level}/g, String(newNivel)).replace(/{xp}/g, String(newXP))
                : `🎉 ¡${message.author.username} ha subido al nivel ${newNivel}!`;
              await levelUpChannel.send({ content: messageText });
            }
          }
        }
      }
    } catch (err) {
      logger.error("Error in XP tracking", {
        error: err instanceof Error ? err.message : String(err),
        userId: message.author?.id,
        guildId,
      });
    }
    // ========== END XP TRACKING ==========

    // ========== IMAGE REPOSTING ==========
    // Early return silencioso si no hay canal de imágenes configurado
    const config = await getGuildConfig(guildId);
    if (!config?.targetChannelId) return;

    try {
      const attachments = Array.from(message.attachments.values());
      if (attachments.length === 0) return;

      if (!config || message.channel.id !== config.targetChannelId) return;

      if (!(message.channel instanceof TextChannel) && !message.channel.isThread()) return;

      const validImageUrls = attachments
        .filter(isValidImageAttachment)
        .map((a) => a.url);

      if (validImageUrls.length === 0) {
        logger.debug("No valid image attachments found for repost", { userId: message.author.id, guildId, totalAttachments: attachments.length });
        return;
      }

      logger.debug("Processing image message for repost", { userId: message.author.id, guildId, channelId: message.channel.id, imageCount: validImageUrls.length });

      await message.channel.send({ files: validImageUrls });
      await message.delete();

      logger.info("Images reposted successfully", { userId: message.author.id, guildId, channelId: message.channel.id, imageCount: validImageUrls.length });
    } catch (err) {
      logger.error("Error reposting images", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        userId: message.author?.id,
        guildId,
        channelId: message.channel?.id,
      });
    }
  },
};
