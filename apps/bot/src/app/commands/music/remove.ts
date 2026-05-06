import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  // CRITICAL: Acknowledge interaction IMMEDIATELY to beat Discord's 3-second window
  await interaction.deferReply();

  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "remove");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.editReply({
        content: "❌ No hay música en la cola.",
      });
      return;
    }

    if (queue.songs.length === 0) {
      await interaction.editReply({
        content: "❌ La cola está vacía.",
      });
      return;
    }

    const position = interaction.options.getInteger("position", true);

    if (position > queue.songs.length) {
      await interaction.editReply({
        content: `❌ Posición inválida. La cola tiene ${queue.songs.length} canción(es).`,
      });
      return;
    }

    const removed = await musicService.removeSong(interaction.guildId, position);

    if (removed) {
      // Obtener el nickname del usuario en el servidor (display name)
      let requesterDisplayName = removed.requester.username;
      if (interaction.guild && removed.requester.id) {
        try {
          const member = await interaction.guild.members.fetch(removed.requester.id);
          requesterDisplayName = member?.displayName || removed.requester.username;
        } catch {
          // Si no se puede obtener el miembro, usar el username
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🗑️ Canción eliminada")
        .setDescription(`**${removed.title}**`)
        .addFields(
          {
            name: "Posición",
            value: `${position}`,
            inline: true,
          },
          {
            name: "Solicitado por",
            value: requesterDisplayName,
            inline: true,
          },
        );

      await interaction.editReply({ embeds: [embed] });

      logger.info("Remove command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        position,
        songTitle: removed.title,
      });
    } else {
      await interaction.editReply({
        content: "❌ No se pudo eliminar la canción.",
      });
    }
  } catch (error) {
    logger.error("Error executing remove command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al eliminar la canción.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage });
    }
  }
}