import {
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from "discord.js";

import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import { CUSTOM_IDS } from "../../interactions/customIds.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "set-welcome");

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser utilizado en servidores.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Obtenemos el canal elegido y abrimos un modal para que el usuario introduzca el mensaje
    const canal = interaction.options.getChannel("canal", true);

    const modal = new ModalBuilder()
      .setCustomId(CUSTOM_IDS.welcome.MODAL(canal.id))
      .setTitle("Configurar mensaje de bienvenida");

    const mensajeInput = new TextInputBuilder()
      .setCustomId("mensaje")
      .setLabel("Mensaje de bienvenida")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(
      mensajeInput,
    );

    modal.addComponents(row);

    await interaction.showModal(modal);

    logger.debug("Mostrando modal de set-welcome", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: canal.id,
    });
  } catch (error) {
    logger.error("Error executing set-welcome command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Error abriendo la interfaz de bienvenida.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}
