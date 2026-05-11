import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

export default async function reason(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const caseNumber = interaction.options.getInteger("id", true);
    const newReason = interaction.options.getString("razon", true);

    const modCase = await ModCaseRepository.findByGuildAndCaseNumber(interaction.guildId, caseNumber);

    if (!modCase) {
      await interaction.editReply({
        content: `❌ No se encontró el caso #${caseNumber}.`,
      });
      return;
    }

    if (!modCase.id) {
      await interaction.editReply({
        content: `❌ Caso #${caseNumber} tiene datos inválidos.`,
      });
      return;
    }

    await ModCaseRepository.updateReason(modCase.id, newReason);

    await interaction.editReply({
      content: `✅ Razón del caso #${caseNumber} actualizada.`,
    });
  } catch (error) {
    logger.error("Error executing /mod reason", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al actualizar la razón. Inténtalo de nuevo.",
    });
  }
}
