import {
  Events,
  VoiceState,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildTextBasedChannel,
} from "discord.js";
import { VoiceConnectionStatus } from "@discordjs/voice";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logVoice } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

const VOICE_ACTION = {
  JOINED: "joined",
  LEFT: "left",
  SWITCHED: "switched",
} as const;

const SLOW_CONFIG_LOOKUP_THRESHOLD_MS = 1000;

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState: VoiceState, newState: VoiceState) {
    const startedAt = Date.now();

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
                {
                  guildId,
                  channelId: oldState.channel.id,
                  channelName: oldState.channel.name,
                },
                "Conexión ya destruida, limpieza de memoria de cola únicamente"
              );
            } else {
              // Conexión válida, usar clearQueue normal
              musicService.clearQueue(guildId);
              logger.info(
                {
                  guildId,
                  channelId: oldState.channel.id,
                  channelName: oldState.channel.name,
                  connectionState,
                },
                "Bot desconectado del canal de voz, cola de música limpiada"
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

      logger.debug(
        {
          guildId: newState.guild.id,
          userId: newState.member?.user.id ?? oldState.member?.user.id,
          oldChannelId: oldState.channel?.id,
          oldChannelName: oldState.channel?.name,
          newChannelId: newState.channel?.id,
          newChannelName: newState.channel?.name,
        },
        "Evento de voz recibido"
      );

      const member = newState.member ?? oldState.member;

      if (!member) {
        logger.warn(
          {
            guildId: newState.guild.id,
            oldChannelId: oldState.channel?.id,
            newChannelId: newState.channel?.id,
          },
          "Evento de voz omitido: miembro no disponible en oldState ni newState"
        );
        return;
      }

      if (!oldState.channel && newState.channel) {
        logVoice(
          member.user.id,
          newState.guild.id,
          VOICE_ACTION.JOINED,
          newState.channel.id
        );
      } else if (oldState.channel && !newState.channel) {
        logVoice(
          member.user.id,
          newState.guild.id,
          VOICE_ACTION.LEFT,
          oldState.channel.id
        );
      } else if (oldState.channel && newState.channel) {
        logVoice(
          member.user.id,
          newState.guild.id,
          VOICE_ACTION.SWITCHED,
          newState.channel.id
        );
      }

      const configStartedAt = Date.now();
      const config = await getGuildConfig(newState.guild.id);
      const configDurationMs = Date.now() - configStartedAt;

      if (configDurationMs > SLOW_CONFIG_LOOKUP_THRESHOLD_MS) {
        logger.warn(
          {
            guildId: newState.guild.id,
            userId: member.user.id,
            oldChannelId: oldState.channel?.id,
            newChannelId: newState.channel?.id,
            configDurationMs,
          },
          "Búsqueda de configuración lenta en evento de voz"
        );
      }

      if (!config || !config.voiceLogChannelId) {
        logger.debug(
          {
            guildId: newState.guild.id,
            userId: newState.member?.user.id ?? oldState.member?.user.id,
            configDurationMs,
          },
          "Evento de voz omitido: servidor sin canal de logs configurado"
        );
        return;
      }

      // Obtener el canal de logs
      const cachedLogChannel = newState.guild.channels.cache.get(
        config.voiceLogChannelId
      );
      const logChannel =
        cachedLogChannel ??
        (await newState.guild.channels.fetch(config.voiceLogChannelId));

      if (!logChannel) {
        logger.warn(
          {
            guildId: newState.guild.id,
            channelId: config.voiceLogChannelId,
          },
          "Canal de logs de voz no encontrado"
        );
        return;
      }

      if (!logChannel.isTextBased() || !("send" in logChannel)) {
        logger.warn(
          {
            guildId: newState.guild.id,
            channelId: config.voiceLogChannelId,
            channelType: logChannel.type,
          },
          "Canal de logs de voz no es un canal de texto enviable"
        );
        return;
      }

      const botMember = newState.guild.members.me;
      const permissions = botMember
        ? logChannel.permissionsFor(botMember)
        : null;

      if (
        !permissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
        ])
      ) {
        logger.warn(
          {
            guildId: newState.guild.id,
            channelId: logChannel.id,
            botUserId: botMember?.id,
          },
          "Permisos insuficientes para enviar logs de voz"
        );
        return;
      }

      const textLogChannel = logChannel as GuildTextBasedChannel;

      // Usuario entró a un canal de voz
      if (!oldState.channel && newState.channel) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00) // Verde
          .setAuthor({
            name: member.user.globalName || member.user.displayName,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(
            `🟢 **${member.nickname || member.user.displayName}** se unió a ${
              newState.channel
            }`
          )
          .addFields({
            name: "Canal de voz",
            value: newState.channel.name,
            inline: true,
          })
          .setTimestamp();

        const sendStartedAt = Date.now();
        await textLogChannel.send({ embeds: [embed] });
        const sendDurationMs = Date.now() - sendStartedAt;

        logger.debug(
          {
            userId: member.user.id,
            nameMember: member.nickname || member.user.displayName,
            guildId: newState.guild.id,
            channelId: newState.channel.id,
            channelName: newState.channel.name,
            configDurationMs,
            sendDurationMs,
            totalDurationMs: Date.now() - startedAt,
            logChannelCacheHit: Boolean(cachedLogChannel),
          },
          "Entrada a canal de voz registrada exitosamente"
        );
      }
      // Usuario salió de un canal de voz
      else if (oldState.channel && !newState.channel) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000) // Rojo
          .setAuthor({
            name: member.user.globalName || member.user.displayName,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(
            `🔴 **${member.nickname || member.user.displayName}** salió de ${
              oldState.channel
            }`
          )
          .addFields({
            name: "Canal de voz",
            value: oldState.channel.name,
            inline: true,
          })
          .setTimestamp();

        const sendStartedAt = Date.now();
        await textLogChannel.send({ embeds: [embed] });
        const sendDurationMs = Date.now() - sendStartedAt;

        logger.debug(
          {
            userId: member.user.id,
            displayName: member.nickname || member.user.displayName,
            guildId: newState.guild.id,
            channelId: oldState.channel.id,
            channelName: oldState.channel.name,
            configDurationMs,
            sendDurationMs,
            totalDurationMs: Date.now() - startedAt,
            logChannelCacheHit: Boolean(cachedLogChannel),
          },
          "Salida de canal de voz registrada exitosamente"
        );
      }
      // Usuario cambió de canal de voz
      else if (
        oldState.channel &&
        newState.channel &&
        oldState.channel.id !== newState.channel.id
      ) {
        const embed = new EmbedBuilder()
          .setColor(0xffa500) // Naranja
          .setAuthor({
            name: member.user.globalName || member.user.displayName,
            iconURL: member.user.displayAvatarURL(),
          })
          .setDescription(
            `🟠 **${
              member.nickname || member.user.displayName
            }** cambió de canal de voz`
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
            }
          )
          .setTimestamp();

        const sendStartedAt = Date.now();
        await textLogChannel.send({ embeds: [embed] });
        const sendDurationMs = Date.now() - sendStartedAt;

        logger.debug(
          {
            userId: member.user.id,
            guildId: newState.guild.id,
            fromChannelId: oldState.channel.id,
            fromChannelName: oldState.channel.name,
            toChannelId: newState.channel.id,
            toChannelName: newState.channel.name,
            configDurationMs,
            sendDurationMs,
            totalDurationMs: Date.now() - startedAt,
            logChannelCacheHit: Boolean(cachedLogChannel),
          },
          "Cambio de canal de voz registrado exitosamente"
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          guildId: newState.guild?.id,
          userId: newState.member?.user.id ?? oldState.member?.user.id,
          oldChannelId: oldState.channel?.id,
          newChannelId: newState.channel?.id,
          totalDurationMs: Date.now() - startedAt,
        },
        "Error en evento voiceStateUpdate"
      );
    }
  },
};
