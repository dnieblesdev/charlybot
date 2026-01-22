import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getPendingRequests } from "../../config/repositories/VerificationRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("list-pending-verifications")
  .setDescription(
    "Lista todas las solicitudes de verificación pendientes (solo moderadores)",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "list-pending-verifications",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const pendingRequests = await getPendingRequests(interaction.guild.id);

    if (pendingRequests.length === 0) {
      await interaction.editReply({
        content: "✅ No hay solicitudes de verificación pendientes.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📋 Solicitudes de Verificación Pendientes")
      .setDescription(
        `Hay **${pendingRequests.length}** solicitud(es) pendiente(s)`,
      )
      .setColor(0xffa500)
      .setTimestamp();

    // Añadir cada solicitud como un campo
    for (const request of pendingRequests.slice(0, 10)) {
      // Máximo 10 para no sobrecargar
      const user = await interaction.client.users
        .fetch(request.userId)
        .catch(() => null);
      const userName = user ? `${user.tag}` : `Usuario ID: ${request.userId}`;
      const requestDate = new Date(request.requestedAt);
      const timeAgo = Math.floor(
        (Date.now() - request.requestedAt) / 1000 / 60,
      ); // minutos

      embed.addFields({
        name: `👤 ${userName}`,
        value:
          `**Nombre en el juego:** ${request.inGameName}\n` +
          `**ID de Solicitud:** \`${request.id}\`\n` +
          `**Solicitado:** hace ${timeAgo < 60 ? `${timeAgo} minutos` : `${Math.floor(timeAgo / 60)} horas`}\n` +
          `**Fecha:** ${requestDate.toLocaleString("es-ES")}`,
        inline: false,
      });
    }

    if (pendingRequests.length > 10) {
      embed.setFooter({
        text: `Mostrando 10 de ${pendingRequests.length} solicitudes pendientes`,
      });
    }

    logger.info("Solicitudes pendientes listadas", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      pendingCount: pendingRequests.length,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error listando solicitudes pendientes", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Hubo un error listando las solicitudes pendientes.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
