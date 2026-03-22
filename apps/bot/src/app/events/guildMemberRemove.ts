import { Events, TextChannel, EmbedBuilder } from "discord.js";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember | PartialGuildMember) {
    try {
      const guildId = member.guild.id;
      const config = await getGuildConfig(guildId);

      if (!config) {
        logger.debug("No hay configuración para este servidor", {
          guildId,
        });
        return;
      }

      const channelId = config.leaveLogChannelId;

      if (!channelId) {
        logger.debug("No hay canal de logs de salida configurado", {
          guildId,
        });
        return;
      }

      const channel = member.guild.channels.cache.get(channelId);

      if (!channel) {
        logger.warn("Canal de logs de salida no encontrado en caché", {
          guildId,
          channelId,
        });
        return;
      }

      if (!(channel instanceof TextChannel) && !channel.isThread()) {
        logger.warn("El canal de logs de salida no es un canal de texto", {
          guildId,
          channelId,
          channelType: channel.type,
        });
        return;
      }

      // Manejar objetos parciales
      const userTag = member.user?.tag || "Usuario Desconocido";
      const userId = member.id;
      const userAvatar =
        member.user?.displayAvatarURL({ size: 256 }) || member.guild.iconURL();

      // Calcular tiempo en el servidor si es posible
      let joinedTimestamp = "";
      if (member.joinedAt) {
        const joinDate = new Date(member.joinedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - joinDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          joinedTimestamp = `Estuvo **${diffDays}** día${diffDays !== 1 ? "s" : ""} en el servidor`;
        } else {
          const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
          joinedTimestamp = `Estuvo **${diffHours}** hora${diffHours !== 1 ? "s" : ""} en el servidor`;
        }
      }

      // Crear embed con diseño atractivo
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c) // Rojo suave para indicar salida
        .setAuthor({
          name: "Miembro abandonó el servidor",
          iconURL: "https://cdn.discordapp.com/emojis/1234567890.png", // Puedes personalizar con un emoji
        })
        .setThumbnail(userAvatar || null)
        .setDescription(`👋 **${userTag}** ha salido del servidor`)
        .addFields(
          {
            name: "👤 Usuario",
            value: `<@${userId}>`,
            inline: true,
          },
          {
            name: "🆔 ID",
            value: `\`${userId}\``,
            inline: true,
          },
          {
            name: "📊 Total de miembros",
            value: `${member.guild.memberCount}`,
            inline: true,
          },
        )
        .setFooter({
          text: `${member.guild.name}`,
          iconURL: member.guild.iconURL() || undefined,
        })
        .setTimestamp();

      // Agregar campo de tiempo en el servidor si está disponible
      if (joinedTimestamp) {
        embed.addFields({
          name: "⏱️ Tiempo en el servidor",
          value: joinedTimestamp,
          inline: false,
        });
      }

      await (channel as TextChannel).send({ embeds: [embed] });

      logger.info("Mensaje de salida enviado correctamente", {
        guildId,
        channelId,
        userId: userId,
        userTag: userTag,
      });
    } catch (error) {
      logger.error("Error al enviar mensaje de salida", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        guildId: member.guild?.id,
        userId: member.id,
      });
    }
  },
};
