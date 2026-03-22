// src/app/events/messageCreate.ts
import { Events, TextChannel } from "discord.js";
import type { Message } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";
import { isValidImageAttachment } from "../../utils/attachmentValidator.ts";

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    try {
      if (message.author.bot) return;
      const guildId = message.guild?.id;
      if (!guildId) return;

      const attachments = Array.from(message.attachments.values());

      if (attachments.length === 0) return;

      const config = await getGuildConfig(guildId);

      if (!config || message.channel.id !== config.targetChannelId) return;

      // Type guard específico para canales que soportan send
      if (
        !(message.channel instanceof TextChannel) &&
        !message.channel.isThread()
      ) {
        return;
      }

      // Filtrar attachments de imagen válidos
      const validImageUrls = attachments
        .filter(isValidImageAttachment)
        .map((a) => a.url);

      // Si no hay imágenes válidas, no hacer nada
      if (validImageUrls.length === 0) {
        logger.debug("No valid image attachments found for repost", {
          userId: message.author.id,
          guildId: guildId,
          totalAttachments: attachments.length,
        });
        return;
      }

      logger.debug("Processing image message for repost", {
        userId: message.author.id,
        guildId: guildId,
        channelId: message.channel.id,
        imageCount: validImageUrls.length,
      });

      // Reenviar solo las imágenes válidas, SIN mencionar al usuario
      await message.channel.send({
        files: validImageUrls,
      });
      await message.delete();

      logger.info("Images reposted successfully", {
        userId: message.author.id,
        guildId: guildId,
        channelId: message.channel.id,
        imageCount: validImageUrls.length,
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
