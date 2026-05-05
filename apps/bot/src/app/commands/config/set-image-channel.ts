import {
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setImagenChannel } from "../../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

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

    await interaction.deferReply();

    const channel = interaction.options.getChannel("canal", true);

    await setImagenChannel(interaction.guild.id, channel.id);

    logger.info("Image channel configured successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: channel.id,
    });

    await interaction.editReply({
      content: `✅ Canal configurado: Las imágenes de <#${channel.id}> serán reenviadas.`,
    });
  } catch (error) {
    logger.error("Error executing set-image-channel command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al configurar el canal de imágenes.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
