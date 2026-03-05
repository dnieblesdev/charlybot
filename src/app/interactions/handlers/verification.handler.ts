/**
 * Verification feature handler.
 *
 * This is a thin dispatcher that delegates to the existing VerificationHandler service.
 * It does NOT contain business logic — all business logic lives in VerificationHandler.ts.
 */

import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import {
  handleVerificationStart,
  handleVerificationApprove,
  handleVerificationReject,
  handleVerificationModalSubmit,
  handleClassSelect,
  handleSubclassSelect,
} from "../../services/VerificationHandler.ts";
import { parseCustomId, CUSTOM_IDS } from "../customIds.ts";
import logger from "../../../utils/logger.ts";

/**
 * Handles button interactions in the verification feature.
 *
 * Dispatches by `action`:
 *  - `start`   → handleVerificationStart
 *  - `approve` → handleVerificationApprove
 *  - `reject`  → handleVerificationReject
 */
export async function handleButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const { action } = parseCustomId(interaction.customId);

  switch (action) {
    case "start":
      await handleVerificationStart(interaction);
      break;

    case "approve":
      await handleVerificationApprove(interaction);
      break;

    case "reject":
      await handleVerificationReject(interaction);
      break;

    default:
      logger.warn("verification.handler: unhandled button action", {
        action,
        customId: interaction.customId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
  }
}

/**
 * Handles modal submit interactions in the verification feature.
 *
 * Routes to handleVerificationModalSubmit (in-game name submission).
 */
export async function handleModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const { action } = parseCustomId(interaction.customId);

  switch (action) {
    case "modal":
      await handleVerificationModalSubmit(interaction);
      break;

    default:
      logger.warn("verification.handler: unhandled modal action", {
        action,
        customId: interaction.customId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
  }
}

/**
 * Handles string select menu interactions in the verification feature.
 *
 * Dispatches by `action`:
 *  - `class-select`    → handleClassSelect
 *  - `subclass-select` → handleSubclassSelect
 */
export async function handleSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const { action } = parseCustomId(interaction.customId);

  switch (action) {
    case "class-select":
      await handleClassSelect(interaction);
      break;

    case "subclass-select":
      await handleSubclassSelect(interaction);
      break;

    default:
      logger.warn("verification.handler: unhandled select action", {
        action,
        customId: interaction.customId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
  }
}
