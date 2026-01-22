import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("nagy")
  .setDescription("La verdad sobre el sensei.");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "nagy");

    await interaction.reply(
      "<@291778526204526602>(huye de amigos en albion) es puto.",
    );

    logger.info("Nagy command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
  } catch (error) {
    logger.error("Error executing nagy command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al ejecutar el comando.";
    if (interaction.replied) {
      // Si ya se respondió, no hacer nada
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
