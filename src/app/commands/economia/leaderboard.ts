import {
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import LeaderboardService from "../../services/economy/LeaderboardService.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "leaderboard");

    await interaction.deferReply();

    // Verificar que el comando se use en un servidor
    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const limit = interaction.options.getInteger("cantidad") || 10;

    // Obtener el leaderboard (basado en ganancia neta del servidor)
    const leaderboard = await LeaderboardService.getLeaderboard(
      interaction.guildId,
      limit,
    );

    if (leaderboard.length === 0) {
      await interaction.editReply({
        content:
          "📊 No hay usuarios en el leaderboard todavía. ¡Usa `/work` para comenzar a ganar dinero!",
      });
      return;
    }

    // Obtener la posición del usuario que ejecutó el comando
    const userPosition = await LeaderboardService.getUserPosition(
      interaction.user.id,
      interaction.guildId,
    );

    // Crear el embed
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Dorado
      .setTitle(`🏆 Leaderboard de ${interaction.guild.name}`)
      .setDescription(
        `Top ${leaderboard.length} usuarios con el mejor profit o ganancia del servidor`,
      )
      .setTimestamp();

    // Emojis de medallas para los primeros 3 lugares
    const medals = ["🥇", "🥈", "🥉"];

    // Crear el campo con el ranking
    let rankingText = "";
    for (const entry of leaderboard) {
      const medal = entry.position <= 3 ? medals[entry.position - 1] : "💰";

      // Resaltar al usuario que ejecutó el comando
      const isCurrentUser = entry.userId === interaction.user.id;
      const highlight = isCurrentUser ? "**➜ " : "";
      const highlightEnd = isCurrentUser ? "**" : "";

      rankingText += `${highlight}${medal} **#${entry.position}** - <@${entry.userId}>${highlightEnd}\n\n`;
    }

    embed.addFields({
      name: "👥 Ranking",
      value: rankingText,
      inline: false,
    });

    // Mostrar posición del usuario si no está en el top mostrado
    if (userPosition && userPosition > limit) {
      embed.addFields({
        name: "📍 Tu Posición",
        value: `Estás en la posición **#${userPosition}**`,
        inline: false,
      });
    }

    embed.setFooter({
      text: "💡 Ranking basado en el profit (total ganado - total perdido) del servidor",
    });

    await interaction.editReply({ embeds: [embed] });

    logger.info("Leaderboard command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      entriesShown: leaderboard.length,
      limit,
    });
  } catch (error) {
    logger.error("Error ejecutando comando leaderboard", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al obtener el leaderboard. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
