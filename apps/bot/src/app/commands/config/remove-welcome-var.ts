import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import { logCommand } from "../../../utils/logger.ts";
import { removeWelcomeCustomVar } from "../../../config/repositories/WelcomeCustomVarRepo.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  const nombre = interaction.options.getString("nombre", true);

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando solo puede ser utilizado en servidores.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  try {
    logCommand(interaction.user.id, interaction.guild.id, "remove-welcome-var");

    await removeWelcomeCustomVar(interaction.guild.id, nombre);

    await interaction.reply({
      content: `✅ Variable de bienvenida **${nombre}** eliminada.`,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    await interaction.reply({
      content: "❌ Error al eliminar la variable de bienvenida.",
      flags: [MessageFlags.Ephemeral],
    });
  }
}