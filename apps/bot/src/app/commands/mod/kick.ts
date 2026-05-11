import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

import {
  canModerate,
  canTargetModerator,
  canTargetSelf,
  canBotAct,
} from "../../services/ModGuardService.js";
import { logModAction } from "../../services/ModLogService.js";
import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

export default async function kick(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const targetUser = interaction.options.getUser("usuario", true);
    const reason = interaction.options.getString("razon") ?? "Sin razón especificada";

    const modMember = await interaction.guild.members.fetch(interaction.user.id);
    const targetMember = await interaction.guild.members.fetch(targetUser.id);

    // Guard checks
    const modCheck = await canModerate(interaction);
    if (!modCheck.allowed) {
      await interaction.editReply({ content: `❌ ${modCheck.reason}` });
      return;
    }

    const selfCheck = canTargetSelf(interaction.user.id, targetUser.id);
    if (!selfCheck.allowed) {
      await interaction.editReply({ content: `❌ ${selfCheck.reason}` });
      return;
    }

    const hierarchyCheck = canTargetModerator(modMember, targetMember);
    if (!hierarchyCheck.allowed) {
      await interaction.editReply({ content: `❌ ${hierarchyCheck.reason}` });
      return;
    }

    const botMember = interaction.client.user
      ? await interaction.guild.members.fetch(interaction.client.user.id)
      : modMember;
    const botCheck = canBotAct(botMember, targetMember);
    if (!botCheck.allowed) {
      await interaction.editReply({ content: `❌ ${botCheck.reason}` });
      return;
    }

    // DM BEFORE kick (user won't be in guild after)
    try {
      await targetUser.send(
        `Has sido expulsado de ${interaction.guild.name}: ${reason}`,
      );
    } catch {
      logger.warn("Failed to send DM for kick", {
        userId: targetUser.id,
        guildId: interaction.guildId,
      });
    }

    // Kick
    await targetMember.kick(reason);

    // Create ModCase
    const modCase = await ModCaseRepository.create({
      guildId: interaction.guildId,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      type: "kick",
      reason,
    });

    // Log action
    const modTag = modMember.user.username;
    const userTag = targetUser.username;
    await logModAction(interaction.client, interaction.guildId, modCase, modTag, userTag);

    await interaction.editReply({
      content: `✅ ${userTag} expulsado. Case #${modCase.caseNumber}`,
    });
  } catch (error) {
    logger.error("Error executing /mod kick", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al ejecutar el kick. Inténtalo de nuevo.",
    });
  }
}
