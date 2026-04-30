import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import * as XPRepo from "../../../config/repositories/XPRepo";
import {
  validateSystemEnabled,
  ERROR_MESSAGES,
  createErrorReply,
} from "../../../utils/validation.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "xp leaderboard");

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;

    // Validar que el sistema de XP esté habilitado
    let xpConfig;
    try {
      xpConfig = await XPRepo.getXPConfig(guildId);
    } catch {
      // Si la API falla o no hay config, treat as disabled
      xpConfig = null;
    }
    
    // Si no hay config (null), el sistema está desactivado
    if (!xpConfig || !validateSystemEnabled(xpConfig.enabled, "XP", "xp config enable")) {
      await interaction.editReply(createErrorReply(ERROR_MESSAGES.SYSTEM_DISABLED("XP", "xp config enable")));
      return;
    }

    // Obtener leaderboard
    const leaderboard = await XPRepo.getXPLeaderboard(guildId, 10);

    if (leaderboard.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle("🏆 Leaderboard de XP")
        .setDescription("No hay usuarios en el ranking de XP todavía.")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Crear descripción con el ranking
    // Fetch all users in parallel with a timeout to avoid N+1 sequential fetches
    const FETCH_TIMEOUT_MS = 3000;
    const fetchUserWithTimeout = (userId: string): Promise<{ id: string; username: string } | null> => {
      return Promise.race([
        interaction.client.users.fetch(userId).then((u) => ({ id: u.id, username: u.username })),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)),
      ]).catch(() => null);
    };

    const userResults = await Promise.all(
      leaderboard.map((entry) => fetchUserWithTimeout(entry.userId)),
    );

    const rankingLines = leaderboard.map((entry, index) => {
      const position = index + 1;
      const medal = getMedal(position);
      const userResult = userResults[index];
      const username = userResult ? userResult.username : `Usuario <${entry.userId}>`;

      return `${medal} **${position}.** ${username} - Nivel ${entry.nivel} | ${entry.xp} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("🏆 Leaderboard de XP")
      .setDescription(rankingLines.join("\n"))
      .setFooter({
        text: `Top ${leaderboard.length} usuarios por XP en este servidor`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info("Leaderboard command executed", {
      guildId,
      userId: interaction.user.id,
      count: leaderboard.length,
    });
  } catch (error) {
    logger.error("Error executing leaderboard command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al obtener el leaderboard.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}

function getMedal(position: number): string {
  switch (position) {
    case 1:
      return "🥇";
    case 2:
      return "🥈";
    case 3:
      return "🥉";
    default:
      return "🔹";
  }
}
