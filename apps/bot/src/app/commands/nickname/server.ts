import { ChatInputCommandInteraction, MessageFlags, DiscordAPIError } from "discord.js";
import logger from "../../../utils/logger.js";

const MAX_NICKNAME_LENGTH = 32;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Este comando solo puede usarse en un servidor.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const guildName = interaction.guild.name;
  const nickname = guildName.length > MAX_NICKNAME_LENGTH
    ? guildName.slice(0, MAX_NICKNAME_LENGTH)
    : guildName;

  if (guildName.length > MAX_NICKNAME_LENGTH) {
    logger.warn("Guild name exceeds 32 chars, truncating", {
      guildId: interaction.guild.id,
      originalLength: guildName.length,
      truncatedLength: nickname.length,
    });
  }

  const botMember = interaction.guild.members.me;
  if (!botMember) {
    await interaction.reply({
      content: "No pude obtener mi información de miembro en este servidor.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  // defer — setNickname is an HTTP call that can exceed Discord's 3s timeout
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    await botMember.setNickname(nickname);
    await interaction.editReply({
      content: `✅ Apodo cambiado a **${nickname}**`,
    });
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === 50013) {
      await interaction.editReply({
        content: "No tengo permiso para cambiar mi apodo en este servidor.",
      });
    } else {
      await interaction.editReply({
        content: "❌ Ocurrió un error inesperado al cambiar el apodo.",
      });
    }
    logger.error("Error setting nickname (server subcommand)", {
      error: error instanceof Error ? error.message : String(error),
      guildId: interaction.guild.id,
      userId: interaction.user.id,
    });
  }
}
