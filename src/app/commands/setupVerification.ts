import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import {
  setVerificationChannel,
  setVerificationReviewChannel,
  setVerifiedRole,
} from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("setup-verification")
  .setDescription(
    "Configura el sistema de verificación de usuarios (solo administradores)",
  )
  .addChannelOption((option) =>
    option
      .setName("verification-channel")
      .setDescription("Canal donde se mostrará el botón de verificación")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("log-channel")
      .setDescription(
        "Canal donde se registrarán las verificaciones (solo logs)",
      )
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option
      .setName("verified-role")
      .setDescription("Rol que se asignará a los usuarios verificados")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "setup-verification",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        ephemeral: true,
      });
      return;
    }

    const verificationChannel = interaction.options.getChannel(
      "verification-channel",
      true,
    );
    const logChannel = interaction.options.getChannel("log-channel", true);
    const verifiedRole = interaction.options.getRole("verified-role", true);

    // Verificar que el bot tenga los permisos necesarios
    const botMember = interaction.guild.members.me;
    if (!botMember) {
      await interaction.reply({
        content: "❌ No puedo encontrar mi propio miembro en el servidor.",
        ephemeral: true,
      });
      return;
    }

    // Guardar la configuración
    await setVerificationChannel(interaction.guild.id, verificationChannel.id);
    await setVerificationReviewChannel(interaction.guild.id, logChannel.id);
    await setVerifiedRole(interaction.guild.id, verifiedRole.id);

    logger.info("Sistema de verificación configurado", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      verificationChannelId: verificationChannel.id,
      logChannelId: logChannel.id,
      verifiedRoleId: verifiedRole.id,
    });

    await interaction.reply({
      content:
        `✅ **Sistema de verificación configurado exitosamente:**\n\n` +
        `📝 Canal de verificación: ${verificationChannel}\n` +
        `📋 Canal de logs: ${logChannel}\n` +
        `✅ Rol de verificado: ${verifiedRole}\n\n` +
        `**Nota:** La verificación es automática. Los usuarios recibirán el rol inmediatamente al registrarse.\n\n` +
        `Usa el comando \`/send-verification-panel\` para enviar el panel de verificación al canal configurado.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error ejecutando setup-verification", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Hubo un error configurando el sistema de verificación.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
