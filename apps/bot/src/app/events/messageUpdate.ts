import { Events, TextChannel } from "discord.js";
import type { Message, PartialMessage } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";
import { buildMessageEditEmbed } from "../../utils/messageAuditEmbeds.ts";

export default {
  name: Events.MessageUpdate,
  once: false,
  async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    try {
      // Guard: Ignore if not in a guild (DMs)
      if (!newMessage.guild) return;

      // Guard: Ignore bots and webhooks
      if (newMessage.author?.bot || newMessage.webhookId) return;

      // Note: oldMessage can be partial; we still want to log with fallbacks.

      // Guard: Ignore if content didn't actually change (e.g. Discord adding link previews/embeds)
      const oldContent = oldMessage.partial ? null : oldMessage.content;
      const newContent = newMessage.partial ? null : newMessage.content;
      if (oldContent !== null && newContent !== null && oldContent === newContent) return;
      if (oldContent === null && newContent === null) return;

      // Guard: Check config
      const config = await getGuildConfig(newMessage.guild.id);
      if (!config || !config.messageLogChannelId) return;

      const channelId = config.messageLogChannelId;

      // Resolve channel
      const channel = newMessage.guild.channels.cache.get(channelId);
      if (!channel) {
        logger.warn("Canal de logs de mensajes no encontrado en caché", {
          guildId: newMessage.guild.id,
          channelId,
        });
        return;
      }

      if (!(channel instanceof TextChannel)) {
        logger.warn("El canal de logs de mensajes no es un canal de texto", {
          guildId: newMessage.guild.id,
          channelId,
          channelType: channel.type,
        });
        return;
      }

      // Get channel name safely
      const channelName =
        "name" in newMessage.channel
          ? newMessage.channel.name || "desconocido"
          : "desconocido";

      // Build jump link
      const jumpLink = `https://discord.com/channels/${newMessage.guild.id}/${newMessage.channelId}/${newMessage.id}`;

      // Build embed
      const embed = buildMessageEditEmbed({
        authorTag: newMessage.member?.displayName || newMessage.author?.tag || "Usuario Desconocido",
        authorAvatarURL:
          newMessage.member?.displayAvatarURL({ size: 256 }) ||
          newMessage.author?.displayAvatarURL({ size: 256 }),
        channelName: newMessage.channel.isThread()
          ? (newMessage.channel.parent?.name || "desconocido") +
            " / " +
            (newMessage.channel.name || "hilo")
          : channelName,
        channelId: newMessage.channelId,
        messageId: newMessage.id,
        jumpLink,
        oldContent,
        newContent,
      });

      await channel.send({ embeds: [embed] });

      logger.info("Mensaje editado registrado", {
        guildId: newMessage.guild.id,
        channelId,
        messageId: newMessage.id,
        authorId: newMessage.author?.id,
      });
    } catch (error) {
      logger.error("Error al registrar mensaje editado", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        guildId: newMessage.guild?.id,
        messageId: newMessage.id,
      });
    }
  },
};
