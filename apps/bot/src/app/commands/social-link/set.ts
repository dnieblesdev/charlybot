import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setSocialLink, listSocialLinks } from "../../../config/repositories/SocialLinkRepo.js";
import logger, { logCommand } from "../../../utils/logger.js";

const MAX_SOCIAL_LINKS = 25;
const URL_REGEX = /^https?:\/\/.+/i;

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "social-link set",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const platform = interaction.options.getString("plataforma", true).trim();
    const url = interaction.options.getString("url", true).trim();

    // Validate URL format
    if (!URL_REGEX.test(url)) {
      await interaction.reply({
        content: "❌ La URL debe comenzar con `http://` o `https://`.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    // Enforce max links limit (skip if updating an existing link)
    const existing = await listSocialLinks(interaction.guild.id);
    if (!existing.has(platform) && existing.size >= MAX_SOCIAL_LINKS) {
      await interaction.editReply({
        content: `❌ Límite de ${MAX_SOCIAL_LINKS} enlaces alcanzado. Eliminá uno antes de agregar otro.`,
      });
      return;
    }

    await setSocialLink(interaction.guild.id, platform, url);

    logger.info("Social link set", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      platform,
      url,
    });

    await interaction.editReply({
      content: `✅ Enlace de **${platform}** configurado: ${url}`,
    });
  } catch (error) {
    logger.error("Error executing social-link set", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al configurar el enlace.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
