/**
 * Welcome feature handler.
 *
 * Handles the welcome modal submission — extracts channelId from the customId
 * payload, validates the guild context, and persists the welcome configuration.
 */

import { MessageFlags } from "discord.js";
import type { ModalSubmitInteraction } from "discord.js";
import {
  setWelcomeChannel,
  setWelcomeMessage,
} from "../../../config/repositories/GuildConfigRepo.ts";
import { parseCustomId } from "../customIds.ts";
import logger from "../../../utils/logger.ts";

/**
 * Handles modal submit interactions in the welcome feature.
 *
 * Expects customId format: `welcome:modal:{channelId}`
 *  - Extracts channelId from payload
 *  - Reads the "mensaje" text input field
 *  - Defers reply before any async work to prevent Discord's 3-second timeout
 *  - Persists welcome message and channel via GuildConfigRepo
 *  - Edits the deferred reply with success or error
 */
export async function handleModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const { payload: channelId } = parseCustomId(interaction.customId);

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este modal solo puede ser procesado en servidores.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  if (!channelId) {
    logger.error("welcome.handler: missing channelId in customId payload", {
      customId: interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.reply({
      content: "❌ Configuración inválida: falta el ID del canal.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  // Defer before any DB writes — Discord kills interactions that don't
  // respond within 3 seconds.
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const mensaje = interaction.fields.getTextInputValue("mensaje");

    await setWelcomeMessage(interaction.guild.id, mensaje);
    await setWelcomeChannel(interaction.guild.id, channelId);

    logger.info("welcome configurado (vía modal)", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId,
      message: mensaje,
    });

    await interaction.editReply({
      content: `✅ Mensaje de bienvenida configurado para <#${channelId}>.\nMensaje: ${mensaje}`,
    });
  } catch (err) {
    logger.error("welcome.handler: error procesando modal set-welcome", {
      error: err instanceof Error ? err.message : String(err),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    // Already deferred, use editReply
    if (interaction.deferred) {
      await interaction.editReply({
        content: "❌ Error guardando la configuración de bienvenida.",
      });
    }
  }
}
