import type { ChatInputCommandInteraction } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import { update as updateGuildConfig } from "../../../config/repositories/GuildConfigRepo.js";
import logger from "../../../utils/logger.js";

export default async function antispam(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Require Administrator for server-wide config changes
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({
        content: "❌ Solo los **administradores** pueden activar o desactivar el anti-spam.",
      });
      return;
    }

    const estado = interaction.options.getString("estado", true);
    const activar = estado === "true";

    await updateGuildConfig(interaction.guildId, { antispamEnabled: activar });

    const label = activar ? "activado" : "desactivado";
    const emoji = activar ? "✅" : "🛑";

    await interaction.editReply({
      content: `${emoji} Sistema anti-spam **${label}** correctamente.`,
    });

    logger.info("Anti-spam toggled", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      activar,
    });
  } catch (error) {
    logger.error("Error executing /mod antispam", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al cambiar el estado del anti-spam. Inténtalo de nuevo.",
    });
  }
}
