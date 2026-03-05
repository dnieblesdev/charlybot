import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { removeClass, classExists } from "../../../config/repositories/ClassRolesRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "remove-class",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const className = interaction.options.getString("nombre", true);

    // Verificar si la clase existe
    const exists = await classExists(className);
    if (!exists) {
      await interaction.reply({
        content: `❌ La clase **${className}** no existe.\n\nUsa \`/list-classes\` para ver las clases configuradas.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await removeClass(className);

    logger.info("Clase eliminada", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      className,
    });

    await interaction.reply({
      content: `✅ La clase **${className}** ha sido eliminada del sistema.`,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    logger.error("Error ejecutando remove-class", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error eliminando la clase.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
