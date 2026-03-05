import { ChatInputCommandInteraction } from "discord.js";
import logger from "../../../utils/logger";
// Descomentar si necesita DB:
// import * as MiRepo from "../../../config/repositories/MiRepo";

export async function execute(interaction: ChatInputCommandInteraction) {
  // Siempre defer antes de cualquier operación async.
  // Usar ephemeral: true si la respuesta es solo para el usuario:
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: "❌ Este comando solo funciona en servidores." });
    return;
  }

  try {
    // Lógica del subcomando aquí

    await interaction.editReply({ content: "✅ Operación completada." });
  } catch (error) {
    logger.error("Error en <subcomando>", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.editReply({ content: "❌ Ocurrió un error inesperado." });
  }
}
