import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("send-verification-panel")
  .setDescription(
    "Envía el panel de verificación al canal configurado (solo administradores)",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "send-verification-panel",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        ephemeral: true,
      });
      return;
    }

    // Obtener la configuración del servidor
    const config = await getGuildConfig(interaction.guild.id);

    if (
      !config ||
      !config.verificationChannelId ||
      !config.verificationReviewChannelId ||
      !config.verifiedRoleId
    ) {
      await interaction.reply({
        content:
          "❌ El sistema de verificación no está configurado.\nUsa `/setup-verification` primero.",
        ephemeral: true,
      });
      return;
    }

    // Obtener el canal de verificación
    const verificationChannel = interaction.guild.channels.cache.get(
      config.verificationChannelId,
    ) as TextChannel;

    if (!verificationChannel) {
      await interaction.reply({
        content: "❌ No puedo encontrar el canal de verificación configurado.",
        ephemeral: true,
      });
      return;
    }

    // Crear el embed
    const embed = new EmbedBuilder()
      .setTitle("🔐 Verificación de Usuario")
      .setDescription(
        "**¡Bienvenido/a al servidor!**\n\n" +
          "Para acceder a todos los canales, necesitas verificarte.\n\n" +
          "**Pasos para verificarte:**\n" +
          "1. Haz clic en el botón **Verificarme** abajo\n" +
          "2. Ingresa tu nombre en el juego en el formulario\n" +
          "3. ¡Listo! Recibirás acceso inmediatamente\n\n" +
          "**Nota:** Tu nombre en el juego será usado como tu apodo en el servidor.",
      )
      .setColor(0x00ff00)
      .setFooter({ text: "Verificación automática - Acceso inmediato" });

    // Crear el botón
    const button = new ButtonBuilder()
      .setCustomId("verification_start")
      .setLabel("Verificarme")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    // Enviar el mensaje al canal
    await verificationChannel.send({
      embeds: [embed],
      components: [row],
    });

    logger.info("Panel de verificación enviado", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: verificationChannel.id,
    });

    await interaction.reply({
      content: `✅ Panel de verificación enviado a ${verificationChannel}`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error enviando panel de verificación", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error enviando el panel de verificación.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
