import type { ChatInputCommandInteraction } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import { update as updateGuildConfig } from "../../../../config/repositories/GuildConfigRepo.js";
import logger from "../../../../utils/logger.js";

export default async function modRole(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Require Administrator for config changes
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "❌ Solo los **administradores** pueden configurar el rol de moderador.",
      });
      return;
    }

    const role = interaction.options.getRole("rol", true);

    await updateGuildConfig(interaction.guildId, { modRoleId: role.id });

    await interaction.editReply({
      content: `✅ Rol de moderador configurado: <@&${role.id}>`,
    });
  } catch (error) {
    logger.error("Error executing /mod config mod-role", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al configurar el rol. Inténtalo de nuevo.",
    });
  }
}
