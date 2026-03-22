import {
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";
import LeaderboardService from "../../services/economy/LeaderboardService.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "balance");

    await interaction.deferReply();

    // Verificar que el comando se use en un servidor
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const username = targetUser.username;

    // Verificar permisos si está consultando el balance de otro usuario
    if (targetUser.id !== interaction.user.id) {
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const isAdmin = member?.permissions.has(
        PermissionFlagsBits.Administrator,
      );

      if (!isAdmin) {
        await interaction.editReply({
          content:
            "❌ Solo los administradores pueden ver el balance de otros usuarios.",
        });
        return;
      }
    }

    // No se puede ver el balance de bots
    if (targetUser.bot) {
      await interaction.editReply({
        content: "❌ Los bots no tienen balance.",
      });
      return;
    }

    // Crear o obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      interaction.guildId,
    );

    // Obtener balance
    const balance = await EconomyService.getBalance(
      userId,
      interaction.guildId,
    );

    // Obtener estadísticas del servidor
    const stats = await EconomyService.getStats(userId, interaction.guildId);

    // Obtener posición en el leaderboard
    const leaderboardPosition = await LeaderboardService.getUserPosition(
      userId,
      interaction.guildId,
    );

    // Verificar si está en prisión
    const inJail = await EconomyService.isInJail(userId, interaction.guildId);
    let jailInfo = "";
    if (inJail && user.jailReleaseAt) {
      const releaseTime = Math.floor(user.jailReleaseAt.getTime() / 1000);
      jailInfo = `\n🚔 **En Prisión hasta:** <t:${releaseTime}:R>`;
    }

    // Crear embed con el balance
    const embed = new EmbedBuilder()
      .setColor(inJail ? 0xff0000 : 0x00aaff)
      .setTitle(`💰 Balance de ${username}`)
      .setDescription(`${jailInfo ? jailInfo : "Estado: ✅ Libre"}`)
      .addFields(
        {
          name: "👛 Bolsillo",
          value: `$${balance.pocket.toFixed(2)}`,
          inline: true,
        },
        {
          name: "🏦 Banco (Global)",
          value: `$${balance.bank.toFixed(2)}`,
          inline: true,
        },
        {
          name: "💵 Total",
          value: `$${balance.total.toFixed(2)}`,
          inline: true,
        },
        {
          name: "📊 Estadísticas",
          value:
            `📈 Total Ganado: $${stats.totalEarned.toFixed(2)}\n` +
            `📉 Total Perdido: $${stats.totalLost.toFixed(2)}\n` +
            `💹 Ganancia Neta: $${stats.netProfit.toFixed(2)}\n` +
            `🏆 Posición: ${leaderboardPosition ? `#${leaderboardPosition}` : "Sin ranking"}`,
          inline: false,
        },
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({
        text: "Usa /deposit y /retirar para manejar tu dinero",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Balance command executed successfully`, {
      requesterId: interaction.user.id,
      targetUserId: userId,
      guildId: interaction.guildId,
      balance: balance.total,
    });
  } catch (error) {
    logger.error("Error executing balance command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al obtener el balance. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
