import { Events, TextChannel, EmbedBuilder } from "discord.js";
import type { GuildMember } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";

function formatWelcomeMessage(template: string, member: GuildMember) {
  // Placeholders simples que puedes ampliar: {user}, {username}, {server}
  return template
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name);
}

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    try {
      const guildId = member.guild.id;
      const config = await getGuildConfig(guildId);

      if (!config) {
        logger.debug("No hay configuración para este servidor", {
          guildId,
        });
        return;
      }

      const channelId = config.welcomeChannelId;
      const messageTemplate = config.welcomeMessage;

      if (!channelId) {
        logger.debug("No hay canal de bienvenida configurado", {
          guildId,
        });
        return;
      }

      const channel = member.guild.channels.cache.get(channelId);

      if (!channel) {
        logger.warn("Canal de bienvenida no encontrado en caché", {
          guildId,
          channelId,
        });
        return;
      }

      if (!(channel instanceof TextChannel) && !channel.isThread()) {
        logger.warn("El canal de bienvenida no es un canal de texto", {
          guildId,
          channelId,
        });
        return;
      }

      // Si hay mensaje personalizado, usarlo
      if (messageTemplate) {
        const finalMessage = formatWelcomeMessage(messageTemplate, member);
        await (channel as TextChannel).send({ content: finalMessage });
      } else {
        // Si no hay mensaje personalizado, usar embed por defecto
        const userAvatar = member.user.displayAvatarURL({ size: 256 });
        const accountCreated = Math.floor(member.user.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71) // Verde para indicar bienvenida
          .setAuthor({
            name: "¡Nuevo miembro!",
            iconURL: member.guild.iconURL() || undefined,
          })
          .setThumbnail(userAvatar)
          .setDescription(
            `🎉 ¡Bienvenido/a **${member.user.tag}** a **${member.guild.name}**!`,
          )
          .addFields(
            {
              name: "👤 Usuario",
              value: `${member}`,
              inline: true,
            },
            {
              name: "🆔 ID",
              value: `\`${member.id}\``,
              inline: true,
            },
            {
              name: "📊 Miembro número",
              value: `#${member.guild.memberCount}`,
              inline: true,
            },
            {
              name: "📅 Cuenta creada",
              value: `<t:${accountCreated}:R>`,
              inline: false,
            },
          )
          .setFooter({
            text: `¡Esperamos que disfrutes tu estancia!`,
            iconURL: member.guild.iconURL() || undefined,
          })
          .setTimestamp();

        await (channel as TextChannel).send({ embeds: [embed] });
      }

      logger.info("Mensaje de bienvenida enviado correctamente", {
        guildId,
        channelId,
        userId: member.id,
        userTag: member.user.tag,
        hasCustomMessage: !!messageTemplate,
      });
    } catch (error) {
      logger.error("Error al enviar mensaje de bienvenida", {
        error: error instanceof Error ? error.message : String(error),
        guildId: member.guild?.id,
      });
    }
  },
};
