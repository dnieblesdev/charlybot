import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from "discord.js";

import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import { CUSTOM_IDS } from "../../interactions/customIds.ts";
import { getGuildConfig } from "../../../config/repositories/GuildConfigRepo.ts";
import { listWelcomeCustomVars } from "../../../config/repositories/WelcomeCustomVarRepo.ts";

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

    // Obtenemos el canal elegido y recuperamos el mensaje actual si existe
    const canal = interaction.options.getChannel("canal", true);
    const config = await getGuildConfig(interaction.guild.id);
    const mensajeActual = config?.welcomeMessage || "";

    // Build helper text for available variables (truncated to Discord's 100-char placeholder limit)
    const customVars = await listWelcomeCustomVars(interaction.guild.id);
    const customVarNames = [...customVars.keys()].map((n) => `{${n}}`);
    const allVars = ["{user}", "{username}", "{server}", ...customVarNames];
    let placeholder = `Vars: ${allVars.join(", ")}`;
    if (placeholder.length > 100) {
      placeholder = placeholder.slice(0, 97) + "...";
    }

    const modal = new ModalBuilder()
      .setCustomId(CUSTOM_IDS.welcome.MODAL(canal.id))
      .setTitle("Configurar mensaje de bienvenida");

    const mensajeInput = new TextInputBuilder()
      .setCustomId("mensaje")
      .setLabel("Mensaje de bienvenida")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(mensajeActual)
      .setPlaceholder(placeholder)
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
