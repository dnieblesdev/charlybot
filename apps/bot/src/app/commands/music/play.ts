import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { ChannelType, EmbedBuilder } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "play");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz para usar este comando.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (
      voiceChannel.type !== ChannelType.GuildVoice &&
      voiceChannel.type !== ChannelType.GuildStageVoice
    ) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz válido.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions?.has("Connect") || !permissions?.has("Speak")) {
      await interaction.reply({
        content:
          "❌ No tengo permisos para conectarme o hablar en ese canal de voz.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // ACK the interaction ASAP — BEFORE heavy operations (join, resolve, stream).
    // Discord expires unacknowledged interactions after 3 seconds.
    await interaction.deferReply();

    const query = interaction.options.getString("query", true);
    const textChannel = interaction.channel;

    if (!textChannel || !textChannel.isTextBased()) {
      await interaction.editReply({
        content: "❌ No se pudo identificar el canal de texto.",
      });
      return;
    }

    // Verificar si el bot ya está en un canal de voz
    let queue = musicService.getQueue(interaction.guildId);

    if (!queue) {
      // Unirse al canal de voz si no está conectado
      await musicService.join(
        interaction.guildId,
        voiceChannel,
        textChannel as any,
      );
    } else if (queue.voiceChannel.id !== voiceChannel.id) {
      // Verificar que el usuario esté en el mismo canal que el bot
      await interaction.editReply({
        content: `❌ Ya estoy reproduciendo música en ${queue.voiceChannel}`,
      });
      return;
    }

    // Agregar a la cola y reproducir
    const result = await musicService.play(interaction.guildId, query, {
      id: interaction.user.id,
      username: interaction.user.username,
    });

    if (result.added.length === 1) {
      const song = result.added[0];
      if (song) {
        // Obtener el nickname del usuario en el servidor (display name)
        let requesterDisplayName = song.requester.username;
        if (interaction.guild && interaction.member) {
          try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            requesterDisplayName = member?.displayName || song.requester.username;
          } catch {
            // Si no se puede obtener el miembro, usar el username
          }
        }

        const embed = new EmbedBuilder()
          .setColor(result.playing ? 0x00ff00 : 0x0099ff)
          .setTitle(
            result.playing ? "🎵 Reproduciendo" : "➕ Agregado a la cola",
          )
          .setDescription(`**${song.title}**`)
          .addFields(
            {
              name: "Duración",
              value: formatDuration(song.duration),
              inline: true,
            },
            {
              name: "Solicitado por",
              value: requesterDisplayName,
              inline: true,
            },
          )
          .setURL(song.url);

        if (song.thumbnail) {
          embed.setThumbnail(song.thumbnail);
        }

        await interaction.editReply({ embeds: [embed] });
      }
    } else {
      // Obtener el nickname del usuario en el servidor (display name)
      let requesterDisplayName = interaction.user.username;
      if (interaction.guild && interaction.member) {
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          requesterDisplayName = member?.displayName || interaction.user.username;
        } catch {
          // Si no se puede obtener el miembro, usar el username
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("📋 Playlist agregada")
        .setDescription(
          `Se agregaron **${result.added.length}** canciones a la cola`,
        )
        .addFields({
          name: "Solicitado por",
          value: requesterDisplayName,
          inline: true,
        });

      if (result.added[0]?.thumbnail) {
        embed.setThumbnail(result.added[0].thumbnail);
      }

      await interaction.editReply({ embeds: [embed] });
    }

    logger.info("Play command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      query,
      songsAdded: result.added.length,
      playing: result.playing,
    });
  } catch (error) {
    logger.error("Error executing play command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // If the interaction token is already dead (expired or already used),
    // Discord returns "Unknown interaction" — we can't respond to the user.
    const isUnknownInteraction =
      error instanceof Error && error.message === "Unknown interaction";

    if (isUnknownInteraction) {
      logger.warn("Interaction token expired — cannot send error reply", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      return;
    }

    const errorMessage =
      error instanceof Error
        ? `❌ ${error.message}`
        : "❌ Error al reproducir la canción.";

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
      }
    } catch (replyError) {
      logger.error("Failed to send error reply to user", {
        error: replyError instanceof Error ? replyError.message : String(replyError),
        commandName: "music play",
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    }
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
