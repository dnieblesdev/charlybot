import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { setSocialLink } from "../../../config/repositories/SocialLinkRepo.js";
import logger, { logCommand } from "../../../utils/logger.js";

const MAX_SOCIAL_LINKS = 25;

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

    const platform = interaction.options.getString("plataforma", true).trim().toLowerCase();
    const url = interaction.options.getString("url", true).trim();

    // Validate URL format using the WHATWG URL parser
    try {
      new URL(url);
    } catch {
      await interaction.reply({
        content: "❌ La URL no es válida. Debe comenzar con `http://` o `https://` y tener un formato correcto.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    await setSocialLink(interaction.guild.id, platform, url, MAX_SOCIAL_LINKS);

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
    const errMsg = error instanceof Error ? error.message : String(error);

    logger.error("Error executing social-link set", {
      error: errMsg,
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (errMsg === "MAX_LINKS_EXCEEDED") {
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Límite de ${MAX_SOCIAL_LINKS} enlaces alcanzado. Eliminá uno antes de agregar otro.`,
        });
      }
      return;
    }

    const errorMessage = "❌ Error al configurar el enlace.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
