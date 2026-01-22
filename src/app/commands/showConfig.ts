import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("show-config")
  .setDescription("Muestra la configuración actual del servidor")
  .addBooleanOption((option) =>
    option
      .setName("publico")
      .setDescription("¿Mostrar la configuración públicamente?")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "show-config");

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en servidores.",
        ephemeral: true,
      });
      return;
    }

    const config = await getGuildConfig(interaction.guild.id);

    if (!config) {
      await interaction.reply({
        content:
          "❌ No hay configuración establecida. Usa `/set-image-channel` o `/set-voice-log` para configurar.",
        ephemeral: true,
      });
      return;
    }

    // Obtener la opción de mostrar públicamente
    const isPublic = interaction.options.getBoolean("publico") ?? false;

    // Crear un embed bonito
    const embed = new EmbedBuilder()
      .setColor(0x00ff99)
      .setTitle("⚙️ Configuración del Servidor")
      .setFooter({
        text: isPublic
          ? `Mostrado por ${interaction.user.username}`
          : `Solo visible para ${interaction.user.username}`,
      })
      .setTimestamp();

    // Agregar canal de imágenes si existe
    if (config.targetChannelId) {
      embed.addFields({
        name: "📸 Canal de Imágenes",
        value: `<#${config.targetChannelId}>`,
        inline: false,
      });
    }

    // Agregar canal de logs de voz si existe
    if (config.voiceLogChannelId) {
      embed.addFields({
        name: "🎤 Canal de Logs de Voz",
        value: `<#${config.voiceLogChannelId}>`,
        inline: false,
      });
    }

    logger.info("Show config command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      isPublic,
      hasImageChannel: !!config.targetChannelId,
      hasVoiceLogChannel: !!config.voiceLogChannelId,
    });

    await interaction.reply({
      embeds: [embed],
      ephemeral: !isPublic,
    });
  } catch (error) {
    logger.error("Error executing show-config command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al mostrar la configuración.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
