import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import logger, { logCommand } from "../../../../utils/logger.ts";
import { removeWelcomeCustomVar } from "../../../../config/repositories/WelcomeCustomVarRepo.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando solo puede ser utilizado en servidores.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  try {
    logCommand(interaction.user.id, interaction.guild.id, "welcome:var:remove");

    const nombre = interaction.options.getString("nombre", true);

    await removeWelcomeCustomVar(interaction.guild.id, nombre);

    await interaction.reply({
      content: `✅ Variable de bienvenida **${nombre}** eliminada.`,
      flags: [MessageFlags.Ephemeral],
    });

    logger.info("welcome:var:remove", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      nombre,
    });
  } catch (error) {
    logger.error("Error executing welcome:var:remove", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Error al eliminar la variable de bienvenida.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}