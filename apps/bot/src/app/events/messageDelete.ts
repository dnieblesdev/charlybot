import { Events, TextChannel } from "discord.js";
import type { Message, PartialMessage } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";
import { buildMessageDeleteEmbed } from "../../utils/messageAuditEmbeds.ts";
import { findMessageDeleteExecutor } from "./auditLogFetcher.ts";
import { wasProcessed, markProcessed, setLastEntryId } from "../../infrastructure/valkey/auditCache.ts";

/**
 * How to verify this feature:
 * 
 * 1. Admin deletes a user message:
 *    - Expected: Embed shows "Eliminado por: @AdminName#0000"
 * 
 * 2. User deletes their own message:
 *    - Expected: Embed shows "Eliminado por: El autor eliminó su propio mensaje"
 * 
 * 3. Message not cached (partial message):
 *    - Expected: Embed still generates, shows content as "Contenido no disponible"
 * 
 * 4. Missing audit log permissions:
 *    - Expected: Embed shows "Eliminado por: Desconocido", no errors to user
 * 
 * 5. Rapid consecutive deletions:
 *    - Expected: Only processes once, no duplicate processing
 */

export default {
  name: Events.MessageDelete,
  once: false,
  async execute(message: Message | PartialMessage) {
    try {
      // Guard: Ignore if not in a guild (DMs)
      if (!message.guild) return;

      // Guard: Ignore bots and webhooks
      if (message.author?.bot || message.webhookId) return;

      // Guard: Check config
      const config = await getGuildConfig(message.guild.id);
      if (!config || !config.messageLogChannelId) return;

      const channelId = config.messageLogChannelId;

      // Resolve channel
      const channel = message.guild.channels.cache.get(channelId);
      if (!channel) {
        logger.warn("Canal de logs de mensajes no encontrado en caché", {
          guildId: message.guild.id,
          channelId,
        });
        return;
      }

      if (!(channel instanceof TextChannel)) {
        logger.warn("El canal de logs de mensajes no es un canal de texto", {
          guildId: message.guild.id,
          channelId,
          channelType: channel.type,
        });
        return;
      }

      // Get channel name safely
      const channelName =
        "name" in message.channel
          ? message.channel.name || "desconocido"
          : "desconocido";

      // Initialize executor info (default: unknown)
      let executorTag: string | undefined;
      let executorAvatarURL: string | undefined;
      let isSelfDelete = false;
      let wasCorrelated = false;
      let entryId: string | undefined;

      // Try to correlate with audit logs to find who deleted the message
      if (message.author && message.guild) {
        try {
          const correlation = await findMessageDeleteExecutor(
            message.guild,
            message.channelId,
            message.author.id,
            new Date(),
          );

          if (correlation) {
            // Check if this entry was already processed (dedupe)
            const alreadyProcessed = await wasProcessed(message.guild.id, correlation.entryId);
            
            if (!alreadyProcessed) {
              // Mark as processed and use the correlation result
              await markProcessed(message.guild.id, correlation.entryId);
              
              executorTag = correlation.executor?.tag ?? undefined;
              executorAvatarURL = correlation.executor?.avatarURL;
              isSelfDelete = correlation.isSelfDelete;
              wasCorrelated = true;
              entryId = correlation.entryId;

              // Update last entry ID cache
              await setLastEntryId(message.guild.id, correlation.entryId);
              
              logger.debug("Audit log correlation successful", {
                guildId: message.guild.id,
                messageId: message.id,
                executorId: correlation.executor?.id,
                isSelfDelete,
                entryId: correlation.entryId,
              });
            } else {
              logger.debug("Audit log entry already processed, skipping", {
                guildId: message.guild.id,
                messageId: message.id,
                entryId: correlation.entryId,
              });
            }
          }
        } catch (error) {
          // Graceful degradation - log error but continue with unknown executor
          logger.warn("Failed to correlate audit log for message deletion", {
            guildId: message.guild.id,
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Build embed - if message is cached, use its content, otherwise show unknown
      const embed = buildMessageDeleteEmbed({
        authorTag: message.member?.displayName || message.author?.tag || "Usuario Desconocido",
        authorAvatarURL:
          message.member?.displayAvatarURL({ size: 256 }) ||
          message.author?.displayAvatarURL({ size: 256 }),
        channelName,
        channelId: message.channelId,
        messageId: message.id,
        content: message.partial ? null : message.content,
        executorTag,
        executorAvatarURL,
        isSelfDelete,
      });

      await channel.send({ embeds: [embed] });

      logger.info("Mensaje eliminado registrado", {
        guildId: message.guild.id,
        channelId,
        messageId: message.id,
        authorId: message.author?.id,
        wasCached: !message.partial,
        executorId: executorTag ? "correlated" : "unknown",
        wasCorrelated,
        entryId,
        isSelfDelete,
      });
    } catch (error) {
      logger.error("Error al registrar mensaje eliminado", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        guildId: message.guild?.id,
        messageId: message.id,
      });
    }
  },
};
