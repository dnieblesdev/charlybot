import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import { logCommand } from "../../../utils/logger.ts";
import { setWelcomeCustomVar } from "../../../config/repositories/WelcomeCustomVarRepo.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  const nombre = interaction.options.getString("nombre", true);
  const valor = interaction.options.getString("valor", true);

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando solo puede ser utilizado en servidores.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  try {
    logCommand(interaction.user.id, interaction.guild.id, "set-welcome-var");

    await setWelcomeCustomVar(interaction.guild.id, nombre, valor);

    await interaction.reply({
      content: `✅ Variable de bienvenida **${nombre}** configurada: \`${valor}\``,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    await interaction.reply({
      content: "❌ Error al guardar la variable de bienvenida.",
      flags: [MessageFlags.Ephemeral],
    });
  }
}