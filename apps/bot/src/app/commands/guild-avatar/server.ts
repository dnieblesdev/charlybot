import { ChatInputCommandInteraction, MessageFlags, DiscordAPIError } from "discord.js";
import logger from "../../../utils/logger.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Este comando solo puede usarse en un servidor.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const iconUrl = interaction.guild.iconURL({ size: 512, extension: "png" });

  if (!iconUrl) {
    await interaction.reply({
      content: "Este servidor no tiene un ícono configurado.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  // defer — editMe is an HTTP call that can exceed Discord's 3s timeout
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const response = await fetch(iconUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    await interaction.guild.members.editMe({ avatar: buffer });

    await interaction.editReply({
      content: "✅ Avatar cambiado al ícono del servidor",
    });
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      if (error.code === 429) {
        await interaction.editReply({
          content: "⏳ Esperá unos minutos antes de cambiar el avatar de nuevo.",
        });
      } else if (error.code === 50013) {
        await interaction.editReply({
          content: "No tengo permiso para cambiar mi avatar en este servidor.",
        });
      } else {
        await interaction.editReply({
          content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
        });
        logger.error("Error setting guild avatar (server subcommand)", {
          error: error instanceof Error ? error.message : String(error),
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });
      }
    } else {
      await interaction.editReply({
        content: "❌ Ocurrió un error inesperado al cambiar el avatar.",
      });
      logger.error("Error setting guild avatar (server subcommand)", {
        error: error instanceof Error ? error.message : String(error),
        guildId: interaction.guild.id,
        userId: interaction.user.id,
      });
    }
  }
}
