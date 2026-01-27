// src/app/events/messageCreate.ts
import { Events, TextChannel } from "discord.js";
import type { Message } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";
import { processAttachments } from "../../utils/attachmentValidator.ts";

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    try {
      if (message.author.bot) return;
      const guildId = message.guild?.id;
      if (!guildId) return;

      const attachments = Array.from(message.attachments.values());

      if (attachments.length === 0) return;

      let config = await getGuildConfig(guildId);

      if (!config || message.channel.id !== config.targetChannelId) return;

      // Type guard específico para canales que soportan send
      if (
        !(message.channel instanceof TextChannel) &&
        !message.channel.isThread()
      ) {
        return;
      }

      // Procesar y validar attachments usando la utilidad
      const {
        validAttachments: downloadedAttachments,
        stats,
        errors,
      } = await processAttachments(attachments, {
        userId: message.author.id,
        guildId: guildId,
      });

      // Si no hay imágenes válidas, no hacer nada
      if (downloadedAttachments.length === 0) {
        logger.debug("No valid image attachments found for repost", {
          userId: message.author.id,
          guildId: guildId,
          totalAttachments: attachments.length,
          errors: errors.slice(0, 3), // Solo primeros 3 errores en log
        });
        return;
      }

      logger.debug("Processing image message for repost", {
        userId: message.author.id,
        guildId: guildId,
        channelId: message.channel.id,
        stats,
      });

      await message.delete();
      // Reenviar solo las imágenes válidas, SIN mencionar al usuario
      await message.channel.send({
        files: downloadedAttachments,
      });

      logger.info("Images reposted successfully", {
        userId: message.author.id,
        guildId: guildId,
        channelId: message.channel.id,
        imageCount: downloadedAttachments.length,
        stats,
      });
    } catch (err) {
      logger.error("Error reposting images", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        userId: message.author?.id,
        guildId: message.guild?.id,
        channelId: message.channel?.id,
      });
    }
  },
};
