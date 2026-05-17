import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import { setWelcomeChannel } from "../../../config/repositories/GuildConfigRepo.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Este comando solo puede ser utilizado en servidores.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  try {
    logCommand(interaction.user.id, interaction.guild.id, "welcome:channel");

    const canal = interaction.options.getChannel("canal", true);

    await setWelcomeChannel(interaction.guild.id, canal.id);

    await interaction.reply({
      content: `✅ Canal de bienvenida establecido: <#${canal.id}>`,
      flags: [MessageFlags.Ephemeral],
    });

    logger.info("welcome:channel", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      channelId: canal.id,
    });
  } catch (error) {
    logger.error("Error executing welcome:channel", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Error al establecer el canal de bienvenida.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}