import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "queue");

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
        content: "❌ No hay música en la cola.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (!queue.currentSong && queue.songs.length === 0) {
      await interaction.reply({
        content: "❌ La cola está vacía.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const page = interaction.options.getInteger("page") || 1;
    const songsPerPage = 10;
    const totalPages = Math.ceil(queue.songs.length / songsPerPage);

    if (page > totalPages && totalPages > 0) {
      await interaction.reply({
        content: `❌ Página inválida. Solo hay ${totalPages} página(s).`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const start = (page - 1) * songsPerPage;
    const end = start + songsPerPage;
    const songsToShow = queue.songs.slice(start, end);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📋 Cola de Reproducción")
      .setTimestamp();

    // Canción actual
    if (queue.currentSong) {
      const statusIcon = queue.isPaused ? "⏸️" : "▶️";
      
      // Obtener el nickname del usuario en el servidor (display name)
      let requesterDisplayName = queue.currentSong.requester.username;
      if (interaction.guild && queue.currentSong.requester.id) {
        try {
          const member = await interaction.guild.members.fetch(queue.currentSong.requester.id);
          requesterDisplayName = member?.displayName || queue.currentSong.requester.username;
        } catch {
          // Si no se puede obtener el miembro, usar el username
        }
      }
      
      embed.addFields({
        name: `${statusIcon} Reproduciendo Ahora`,
        value: `**${queue.currentSong.title}**\n\`${formatDuration(queue.currentSong.duration)}\` | Solicitado por ${requesterDisplayName}`,
        inline: false,
      });
    }

    // Lista de canciones en cola
    if (songsToShow.length > 0) {
      const queueList = songsToShow
        .map((song, index) => {
          const position = start + index + 1;
          return `**${position}.** ${song.title}\n\`${formatDuration(song.duration)}\` | ${song.requester.username}`;
        })
        .join("\n\n");

      embed.addFields({
        name: "🎵 Próximas Canciones",
        value: queueList,
        inline: false,
      });
    }

    // Información adicional
    const footerText = [];

    if (queue.songs.length > 0) {
      const totalDuration = queue.songs.reduce(
        (sum, song) => sum + song.duration,
        0,
      );
      footerText.push(
        `${queue.songs.length} canción(es) en cola | Duración total: ${formatDuration(totalDuration)}`,
      );
    }

    if (totalPages > 1) {
      footerText.push(`Página ${page}/${totalPages}`);
    }

    if (queue.loopMode !== "none") {
      const loopText =
        queue.loopMode === "song"
          ? "🔂 Repitiendo canción"
          : "🔁 Repitiendo cola";
      footerText.push(loopText);
    }

    if (footerText.length > 0) {
      embed.setFooter({ text: footerText.join(" | ") });
    }

    await interaction.reply({ embeds: [embed] });

    logger.info("Queue command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      page,
      totalSongs: queue.songs.length,
    });
  } catch (error) {
    logger.error("Error executing queue command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al mostrar la cola.";
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
