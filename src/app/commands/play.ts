import { SlashCommandBuilder } from "@discordjs/builders";
import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { ChannelType, EmbedBuilder } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Reproduce una canción o playlist de YouTube/Spotify")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("URL o nombre de la canción/playlist")
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "play");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz para usar este comando.",
        ephemeral: true,
      });
      return;
    }

    if (
      voiceChannel.type !== ChannelType.GuildVoice &&
      voiceChannel.type !== ChannelType.GuildStageVoice
    ) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz válido.",
        ephemeral: true,
      });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions?.has("Connect") || !permissions?.has("Speak")) {
      await interaction.reply({
        content:
          "❌ No tengo permisos para conectarme o hablar en ese canal de voz.",
        ephemeral: true,
      });
      return;
    }

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
              value: song.requester.username,
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
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("📋 Playlist agregada")
        .setDescription(
          `Se agregaron **${result.added.length}** canciones a la cola`,
        )
        .addFields({
          name: "Solicitado por",
          value: interaction.user.username,
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

    const errorMessage =
      error instanceof Error
        ? `❌ ${error.message}`
        : "❌ Error al reproducir la canción.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
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
