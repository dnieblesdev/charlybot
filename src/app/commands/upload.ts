import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction, TextChannel } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";
import { processAttachments } from "../../utils/attachmentValidator.ts";

export const data = new SlashCommandBuilder()
  .setName("upload")
  .setDescription("Sube imágenes al canal configurado (hasta 10)")
  .addAttachmentOption((option) =>
    option
      .setName("imagen1")
      .setDescription("Primera imagen")
      .setRequired(true),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen2").setDescription("Segunda imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen3").setDescription("Tercera imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen4").setDescription("Cuarta imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen5").setDescription("Quinta imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen6").setDescription("Sexta imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen7").setDescription("Séptima imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen8").setDescription("Octava imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen9").setDescription("Novena imagen (opcional)"),
  )
  .addAttachmentOption((option) =>
    option.setName("imagen10").setDescription("Décima imagen (opcional)"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "upload");

    // ⭐ Diferir la respuesta inmediatamente para ganar tiempo
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      logger.warn("Upload command used outside guild", {
        userId: interaction.user.id,
      });
      await interaction.editReply({
        content: "❌ Este comando solo funciona en servidores.",
      });
      return;
    }

    // Obtener la configuración del servidor
    const config = await getGuildConfig(interaction.guild.id);
    if (!config || !config.targetChannelId) {
      logger.warn("Upload attempted without configured channel", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });
      await interaction.editReply({
        content:
          "❌ No hay un canal configurado. Usa `/set-image-channel` primero.",
      });
      return;
    }

    // Recopilar todas las imágenes adjuntas
    const attachments = [];
    for (let i = 1; i <= 10; i++) {
      const attachment = interaction.options.getAttachment(`imagen${i}`);
      if (attachment) {
        attachments.push(attachment);
      }
    }

    if (attachments.length === 0) {
      await interaction.editReply({
        content: "❌ No se encontraron imágenes.",
      });
      return;
    }

    // Procesar y validar attachments usando la utilidad
    const {
      validAttachments: imageAttachments,
      stats,
      errors,
    } = await processAttachments(attachments, {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    // Si no hay imágenes válidas, mostrar errores específicos
    if (imageAttachments.length === 0) {
      const errorMessage =
        errors.length > 0
          ? `❌ ${errors[0]}`
          : "❌ No se encontraron imágenes válidas.";

      await interaction.editReply({
        content: errorMessage,
      });
      return;
    }

    // Si algunas fallaron, informar al usuario
    if (stats.failed > 0 && imageAttachments.length > 0) {
      logger.warn("Some attachments failed validation", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        total: stats.totalProcessed,
        successful: stats.successfullyValidated,
        failed: stats.failed,
        errors,
      });
    }

    // Obtener el canal configurado
    const channel = await interaction.guild.channels.fetch(
      config.targetChannelId,
    );
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({
        content: "❌ No se pudo encontrar el canal configurado.",
      });
      return;
    }

    // Enviar las imágenes al canal SIN mencionar al usuario
    await (channel as TextChannel).send({
      files: imageAttachments,
    });

    logger.info("Images uploaded successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: config.targetChannelId,
      imageCount: imageAttachments.length,
      stats,
    });

    const successMessage =
      stats.failed > 0
        ? `✅ ${imageAttachments.length} imagen(es) enviada(s) a <#${config.targetChannelId}> (${stats.failed} fallaron)`
        : `✅ ${imageAttachments.length} imagen(es) enviada(s) a <#${config.targetChannelId}>`;

    await interaction.editReply({
      content: successMessage,
    });
  } catch (error) {
    logger.error("Error executing upload command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // Intentar responder al usuario
    try {
      const errorMessage =
        "❌ Hubo un error inesperado al procesar tu solicitud.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (replyError) {
      logger.error("Failed to reply to user after upload error", {
        error:
          replyError instanceof Error ? replyError.message : String(replyError),
        userId: interaction.user.id,
      });
    }
  }
}
