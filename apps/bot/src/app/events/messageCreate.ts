// src/app/events/messageCreate.ts
import { Events, TextChannel } from "discord.js";
import type { Message } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import * as XPRepo from "../../config/repositories/XPRepo";
import logger from "../../utils/logger.ts";
import { isValidImageAttachment } from "../../utils/attachmentValidator.ts";

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (message.author.bot) return;
    const guildId = message.guild?.id;
    if (!guildId) return;

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
