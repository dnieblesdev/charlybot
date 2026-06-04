import type { ChatInputCommandInteraction } from "discord.js";

import {
  canModerate,
  canTargetModerator,
  canTargetSelf,
  canBotAct,
  MODERATION_ACTION,
} from "../../services/ModGuardService.js";
import { logModAction } from "../../services/ModLogService.js";
import { enforceWarnThreshold } from "../../services/WarnThresholdService.js";
import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import logger from "../../../utils/logger.js";

export default async function warn(interaction: ChatInputCommandInteraction) {
  try {
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
    const modCheck = await canModerate(interaction, MODERATION_ACTION.WARN);
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

    const botCheck = canBotAct(interaction.client.user ? await interaction.guild.members.fetch(interaction.client.user.id) : modMember, targetMember);
    if (!botCheck.allowed) {
      await interaction.editReply({ content: `❌ ${botCheck.reason}` });
      return;
    }

    // Create ModCase
    const modCase = await ModCaseRepository.create({
      guildId: interaction.guildId,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      type: "warn",
      reason,
    });

    // Log action
    const modTag = `${modMember.user.username}`;
    const userTag = `${targetUser.username}`;
    await logModAction(interaction.client, interaction.guildId, modCase, modTag, userTag);

    // DM the user
    try {
      await targetUser.send(
        `Has sido advertido en ${interaction.guild.name}: ${reason}`,
      );
    } catch {
      logger.warn("Failed to send DM for warn", {
        userId: targetUser.id,
        guildId: interaction.guildId,
      });
    }

    let thresholdMessage = "";

    try {
      const thresholdResult = await enforceWarnThreshold({
        client: interaction.client,
        guild: interaction.guild,
        guildId: interaction.guildId,
        targetMember,
        targetUser,
        moderatorId: interaction.user.id,
        moderatorTag: modTag,
        userTag,
      });

      if (thresholdResult.matched && thresholdResult.message) {
        thresholdMessage = thresholdResult.ok
          ? `\n🔁 ${thresholdResult.message}`
          : `\n⚠️ Warn registrado, pero ${thresholdResult.message}`;
      }
    } catch (thresholdError) {
      const errorMessage = thresholdError instanceof Error
        ? thresholdError.message
        : String(thresholdError);

      logger.warn("Warn threshold enforcement failed after warn creation", {
        guildId: interaction.guildId,
        userId: targetUser.id,
        caseNumber: modCase.caseNumber,
        error: errorMessage,
      });

      thresholdMessage = `\n⚠️ Warn registrado, pero la escalada automática falló: ${errorMessage}`;
    }

    await interaction.editReply({
      content: `✅ ${userTag} advertido. Case #${modCase.caseNumber}${thresholdMessage}`,
    });
  } catch (error) {
    logger.error("Error executing /mod warn", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al ejecutar la advertencia. Inténtalo de nuevo.",
    });
  }
}
