import { Events, VoiceState, EmbedBuilder, TextChannel } from "discord.js";
import { VoiceConnectionStatus } from "@discordjs/voice";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logVoice } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState: VoiceState, newState: VoiceState) {
    try {
      // Detectar si el bot fue desconectado del canal de voz
      if (
        oldState.member?.user.bot &&
        oldState.member?.user.id === oldState.client.user?.id &&
        oldState.channel &&
        !newState.channel
      ) {
        // El bot fue desconectado/expulsado del canal de voz
        const guildId = oldState.guild?.id;
        if (guildId) {
          // Verificar si hay una cola activa antes de limpiarla
          const queue = musicService.getQueue(guildId);
          if (queue) {
            // Verificar si la conexión ya está destruida para evitar doble destrucción
            const connectionState = queue.connection?.state.status;

            if (connectionState === VoiceConnectionStatus.Destroyed) {
              // La conexión ya está destruida, usar método específico para esta situación
              musicService.cleanQueueAfterDisconnect(guildId);
              logger.debug(
                "Conexión ya destruida, limpieza de memoria de cola únicamente",
                {
                  guildId,
                  channelId: oldState.channel.id,
                  channelName: oldState.channel.name,
                },
              );
            } else {
              // Conexión válida, usar clearQueue normal
              musicService.clearQueue(guildId);
              logger.info(
                "Bot desconectado del canal de voz, cola de música limpiada",
                {
                  guildId,
                  channelId: oldState.channel.id,
                  channelName: oldState.channel.name,
                  connectionState,
                },
              );
            }
          }
        }
        return;
      }

      // Si el canal no cambió (mute/deafen/camera/etc.), no hay nada que loguear
      if (oldState.channel?.id === newState.channel?.id) return;

      // Obtener la configuración del servidor
      if (!newState.guild) return;

      const config = await getGuildConfig(newState.guild.id);
      if (!config || !config.voiceLogChannelId) return;

      // Obtener el canal de logs
      const logChannel = newState.guild.channels.cache.get(
        config.voiceLogChannelId,
      ) as TextChannel;

      if (!logChannel) {
        logger.warn("Canal de logs de voz no encontrado", {
          guildId: newState.guild.id,
          channelId: config.voiceLogChannelId,
        });
        return;
      }

      const member = newState.member;
      if (!member) return;

      // Usuario entró a un canal de voz
      if (!oldState.channel && newState.channel) {
        logVoice(
          member.user.id,
          newState.guild.id,
          "joined",
          newState.channel.id,
        );

        const embed = new EmbedBuilder()
          .setColor(0x00ff00) // Verde
          .setAuthor({
            name: member.user.globalName || member.user.displayName,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(
            `🟢 **${member.nickname || member.user.displayName}** se unió a ${newState.channel}`,
          )
          .addFields({
            name: "Canal de voz",
            value: newState.channel.name,
            inline: true,
          })
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });

        logger.debug("Entrada a canal de voz registrada exitosamente", {
          userId: member.user.id,
          nameMember: member.nickname || member.user.displayName,
          guildId: newState.guild.id,
          channelId: newState.channel.id,
          channelName: newState.channel.name,
        });
      }
      // Usuario salió de un canal de voz
      else if (oldState.channel && !newState.channel) {
        logVoice(
          member.user.id,
          newState.guild.id,
          "left",
          oldState.channel.id,
        );

        const embed = new EmbedBuilder()
          .setColor(0xff0000) // Rojo
          .setAuthor({
            name: member.user.globalName || member.user.displayName,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(
            `🔴 **${member.nickname || member.user.displayName}** salió de ${oldState.channel}`,
          )
          .addFields({
            name: "Canal de voz",
            value: oldState.channel.name,
            inline: true,
          })
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });

        logger.debug("Salida de canal de voz registrada exitosamente", {
          userId: member.user.id,
          displayName: member.nickname || member.user.displayName,
          guildId: newState.guild.id,
          channelId: oldState.channel.id,
          channelName: oldState.channel.name,
        });
      }
      // Usuario cambió de canal de voz
      else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
      ) {
        logVoice(
          member.user.id,
          newState.guild.id,
          "switched",
          newState.channel.id,
        );

        const embed = new EmbedBuilder()
          .setColor(0xffa500) // Naranja
          .setAuthor({
            name: member.user.globalName || member.user.displayName,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(
            `🟠 **${member.nickname || member.user.displayName}** cambió de canal de voz`,
          )
          .addFields(
            {
              name: "Desde",
              value: oldState.channel.name,
              inline: true,
            },
            {
              name: "Hacia",
              value: newState.channel.name,
              inline: true,
            },
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });

        logger.debug("Cambio de canal de voz registrado exitosamente", {
          userId: member.user.id,
          guildId: newState.guild.id,
          fromChannelId: oldState.channel.id,
          fromChannelName: oldState.channel.name,
          toChannelId: newState.channel.id,
          toChannelName: newState.channel.name,
        });
      }
    } catch (error) {
      logger.error("Error en evento voiceStateUpdate", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        guildId: newState.guild?.id,
        userId: newState.member?.user.id,
      });
    }
  },
};
