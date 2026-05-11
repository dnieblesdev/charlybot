import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
  type UserContextMenuCommandInteraction,
} from "discord.js";

import {
  canModerate,
  canTargetModerator,
  canTargetSelf,
  canBotAct,
} from "../../services/ModGuardService.js";
import { logModAction } from "../../services/ModLogService.js";
import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

export const data = new ContextMenuCommandBuilder()
  .setName("Ban User")
  .setType(ApplicationCommandType.User);

export async function execute(interaction: UserContextMenuCommandInteraction) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (!interaction.guildId || !interaction.guild) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const targetUser = interaction.targetUser;
    const targetMember = await interaction.guild.members.fetch(targetUser.id);
    const modMember = await interaction.guild.members.fetch(interaction.user.id);

    // Guard checks
    const modCheck = await canModerate(
      interaction as unknown as Parameters<typeof canModerate>[0],
    );
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

    // Create ModCase first (guaranteed record even if Discord action fails)
    const reason = "Sin razón (context menu)";
    const modCase = await ModCaseRepository.create({
      guildId: interaction.guildId,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      type: "ban",
      reason,
    });

    // DM the user before banning
    try {
      await targetUser.send(
        `Has sido baneado de ${interaction.guild.name}: ${reason}`,
      );
    } catch {
      logger.warn("Failed to send DM for context menu ban", {
        userId: targetUser.id,
        guildId: interaction.guildId,
      });
    }

    // Execute ban
    await targetMember.ban({ deleteMessageSeconds: 0, reason });

    // Log action
    const modTag = modMember.user.username;
    const userTag = targetUser.username;
    await logModAction(
      interaction.client,
      interaction.guildId,
      modCase,
      modTag,
      userTag,
    );

    await interaction.editReply({
      content: `✅ ${userTag} baneado. Case #${modCase.caseNumber}`,
    });
  } catch (error) {
    logger.error("Error executing Ban User context menu", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al ejecutar el ban. Inténtalo de nuevo.",
    });
  }
}
