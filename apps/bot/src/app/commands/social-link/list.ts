import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { listSocialLinks } from "../../../config/repositories/SocialLinkRepo.js";
import logger, { logCommand } from "../../../utils/logger.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "social-link list",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const links = await listSocialLinks(interaction.guild.id);

    if (links.size === 0) {
      await interaction.editReply({
        content: "📭 No hay enlaces a redes sociales configurados.\nUsa `/social-link set <plataforma> <url>` para añadir uno.",
      });
      return;
    }

    const lines = Array.from(links.entries())
      .map(([platform, url]) => `• **${platform}** → ${url}`)
      .join("\n");

    await interaction.editReply({
      content: `🔗 **Enlaces configurados**\n\n${lines}`,
    });

    logger.info("Social links listed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      count: links.size,
    });
  } catch (error) {
    logger.error("Error executing social-link list", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al listar los enlaces.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}