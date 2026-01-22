import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setImagenChannel } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("set-image-channel")
  .setDescription("Configura el canal para reenviar imágenes")
  .addChannelOption((option) =>
    option
      .setName("canal")
      .setDescription("El canal donde se reenviarán las imágenes")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "set-image-channel",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en servidores.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.options.getChannel("canal", true);

    await setImagenChannel(interaction.guild.id, channel.id);

    logger.info("Image channel configured successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: channel.id,
    });

    await interaction.reply({
      content: `✅ Canal configurado: Las imágenes de <#${channel.id}> serán reenviadas.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("Error executing set-image-channel command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al configurar el canal de imágenes.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
