import type { ChatInputCommandInteraction } from "discord.js";

import { canModerate } from "../../services/ModGuardService.js";
import { logModAction } from "../../services/ModLogService.js";
import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

export default async function unban(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const userId = interaction.options.getString("usuario_id", true);
    const reason = interaction.options.getString("razon") ?? "Sin razón especificada";

    // Guard: canModerate
    const modCheck = await canModerate(interaction);
    if (!modCheck.allowed) {
      await interaction.editReply({ content: `❌ ${modCheck.reason}` });
      return;
    }

    // Verify user is actually banned
    let ban;
    try {
      ban = await interaction.guild.bans.fetch(userId);
    } catch {
      await interaction.editReply({
        content: "❌ Ese usuario no está baneado en este servidor.",
      });
      return;
    }

    // Deactivate active ModCase for this user's ban
    const cases = await ModCaseRepository.findByUser(interaction.guildId, userId);
    const activeBanCase = cases.find((c) => c.type === "ban" && c.active);
    if (activeBanCase) {
      await ModCaseRepository.deactivate(activeBanCase.id);
    }

    // Remove ban
    await interaction.guild.bans.remove(userId, reason);

    // Create ModCase
    const modCase = await ModCaseRepository.create({
      guildId: interaction.guildId,
      userId,
      moderatorId: interaction.user.id,
      type: "unban",
      reason,
    });

    // Log action
    const modMember = await interaction.guild.members.fetch(interaction.user.id);
    const modTag = modMember.user.username;
    const userTag = ban.user.username;
    await logModAction(interaction.client, interaction.guildId, modCase, modTag, userTag);

    await interaction.editReply({
      content: `✅ ${userTag} desbaneado. Case #${modCase.caseNumber}`,
    });
  } catch (error) {
    logger.error("Error executing /mod unban", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al ejecutar el unban. Inténtalo de nuevo.",
    });
  }
}
