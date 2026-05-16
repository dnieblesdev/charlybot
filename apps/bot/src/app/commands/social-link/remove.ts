import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import {
  removeSocialLink,
  getSocialLink,
} from "../../../config/repositories/SocialLinkRepo.js";
import logger, { logCommand } from "../../../utils/logger.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "social-link remove",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const platform = interaction.options.getString("plataforma", true).toLowerCase();
    await interaction.deferReply();

    // Check existence
    const existing = await getSocialLink(interaction.guild.id, platform);
    if (!existing) {
      await interaction.editReply({
        content: `❌ No existe un enlace para **${platform}**.\n\nUsa \`/social-link list\` para ver los enlaces configurados.`,
      });
      return;
    }

    await removeSocialLink(interaction.guild.id, platform);

    logger.info("Social link removed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      platform,
    });

    await interaction.editReply({
      content: `✅ Enlace de **${platform}** eliminado.`,
    });
  } catch (error) {
    logger.error("Error executing social-link remove", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al eliminar el enlace.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}