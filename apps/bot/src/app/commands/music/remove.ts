import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "remove");

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

    if (queue.songs.length === 0) {
      await interaction.reply({
        content: "❌ La cola está vacía.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const position = interaction.options.getInteger("position", true);

    if (position > queue.songs.length) {
      await interaction.reply({
        content: `❌ Posición inválida. La cola tiene ${queue.songs.length} canción(es).`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const removed = musicService.removeSong(interaction.guildId, position);

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

      await interaction.reply({ embeds: [embed] });

      logger.info("Remove command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        position,
        songTitle: removed.title,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo eliminar la canción.",
        flags: [MessageFlags.Ephemeral],
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
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
