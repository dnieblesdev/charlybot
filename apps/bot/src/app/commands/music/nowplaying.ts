import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, MessageFlags } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "nowplaying");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.reply({
        content: "❌ No hay música reproduciéndose.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (!queue.currentSong) {
      await interaction.reply({
        content: "❌ No hay ninguna canción reproduciéndose actualmente.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const song = queue.currentSong;
    const statusIcon = queue.isPaused ? "⏸️" : "▶️";
    const statusText = queue.isPaused ? "Pausado" : "Reproduciendo";

    // Obtener el nickname del usuario en el servidor (display name)
    let requesterDisplayName = song.requester.username;
    if (interaction.guild && song.requester.id) {
      try {
        const member = await interaction.guild.members.fetch(song.requester.id);
        requesterDisplayName = member?.displayName || song.requester.username;
      } catch {
        // Si no se puede obtener el miembro, usar el username
      }
    }

    const embed = new EmbedBuilder()
      .setColor(queue.isPaused ? 0xffa500 : 0x00ff00)
      .setTitle(`${statusIcon} ${statusText}`)
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
        {
          name: "Volumen",
          value: `${queue.volume}%`,
          inline: true,
        },
      )
      .setURL(song.url)
      .setTimestamp();

    if (song.thumbnail) {
      embed.setThumbnail(song.thumbnail);
    }

    if (queue.loopMode !== "none") {
      const loopText =
        queue.loopMode === "song"
          ? "🔂 Repitiendo esta canción"
          : "🔁 Repitiendo cola";
      embed.addFields({
        name: "Modo de repetición",
        value: loopText,
        inline: false,
      });
    }

    if (queue.songs.length > 0) {
      const nextSong = queue.songs[0];
      if (nextSong) {
        embed.addFields({
          name: "Siguiente",
          value: `**${nextSong.title}**`,
          inline: false,
        });
      }
      embed.setFooter({
        text: `${queue.songs.length} canción(es) en cola`,
      });
    }

    await interaction.reply({ embeds: [embed] });

    logger.info("Nowplaying command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      currentSong: song.title,
    });
  } catch (error) {
    logger.error("Error executing nowplaying command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al mostrar la canción actual.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
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
