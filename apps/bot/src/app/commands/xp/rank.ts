import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { HttpXPAdapter } from "../../../infrastructure/api/HttpXPAdapter.js";
import * as XPRepo from "../../../config/repositories/XPRepo";
import {
  validateSystemEnabled,
  ERROR_MESSAGES,
  createErrorReply,
} from "../../../utils/validation.js";

const xpAdapter = new HttpXPAdapter();

// Función para calcular XP necesaria para el siguiente nivel
// Fórmula: 100 * nivel^2 (ej: nivel 1=100, nivel 2=400, nivel 3=900, etc.)
function getXPForNextLevel(level: number): number {
  return 100 * Math.pow(level + 1, 2);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "xp rank");

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

    // Si no se especifica usuario, usar el usuario que ejecuta el comando
    const targetUser =
      interaction.options.getUser("usuario") || interaction.user;
    const userId = targetUser.id;
    const username = targetUser.username;

    // Obtener datos de XP del usuario
    let userXP = await xpAdapter.getUserXP(guildId, userId);

    // Si el usuario no tiene XP, mostrar que es nuevo
    if (!userXP) {
      const embed = new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle(`📊 Rango de ${username}`)
        .setDescription(
          "Todavía no registramos actividad para este usuario en este servidor. Mandá mensajes para empezar a ganar XP y subir de nivel.",
        )
        .addFields(
          {
            name: "Nivel",
            value: "0",
            inline: true,
          },
          {
            name: "XP Actual",
            value: "0",
            inline: true,
          },
          {
            name: "XP para siguiente nivel",
            value: "100",
            inline: true,
          },
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const currentLevel = userXP.nivel;
    const currentXP = userXP.xp;
    const xpForNext = getXPForNextLevel(currentLevel);
    const xpProgress = currentXP - (currentLevel > 0 ? getXPForNextLevel(currentLevel - 1) : 0);
    const xpNeeded = xpForNext - (currentLevel > 0 ? getXPForNextLevel(currentLevel - 1) : 0);
    const progressPercent = Math.min(100, Math.round((xpProgress / xpNeeded) * 100));

    // Crear barra de progreso
    const progressBar = createProgressBar(progressPercent);

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle(`📊 Rango de ${username}`)
      .addFields(
        {
          name: "Nivel",
          value: `**${currentLevel}**`,
          inline: true,
        },
        {
          name: "XP Actual",
          value: `**${currentXP}** XP`,
          inline: true,
        },
        {
          name: "XP para siguiente nivel",
          value: `${xpForNext - currentXP} XP`,
          inline: true,
        },
        {
          name: "Progreso",
          value: `${progressBar} ${progressPercent}%`,
          inline: false,
        },
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info("Rank command executed", {
      guildId,
      userId,
      targetUserId: targetUser.id,
      level: currentLevel,
      xp: currentXP,
    });
  } catch (error) {
    logger.error("Error executing rank command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al obtener el rango del usuario.";
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

function createProgressBar(percent: number): string {
  const totalBlocks = 10;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;

  return "▓".repeat(filledBlocks) + "░".repeat(emptyBlocks);
}
