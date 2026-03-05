import type { ChatInputCommandInteraction } from "discord.js";
import {
  removeGuildConfig,
  getGuildConfig,
} from "../../../config/repositories/GuildConfigRepo.ts";
import { isOwnerInteraction } from "../../../utils/permissions.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "remove-config",
    );

    // Verificar que sea el propietario
    if (!isOwnerInteraction(interaction)) {
      logger.warn("Unauthorized remove-config attempt", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      await interaction.reply({
        content: "❌ Solo el propietario del bot puede usar este comando.",
        ephemeral: true,
      });
      return;
    }

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo funciona en servidores.",
        ephemeral: true,
      });
      return;
    }

    const config = await getGuildConfig(interaction.guild.id);

    if (!config) {
      logger.info("Remove config attempted but no config exists", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });
      await interaction.reply({
        content: "❌ No hay configuración para eliminar.",
        ephemeral: true,
      });
      return;
    }

    await removeGuildConfig(interaction.guild.id);

    logger.info("Config removed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    await interaction.reply({
      content: `✅ Configuración eliminada exitosamente.\n🔒 Acción realizada por ${interaction.user.username}`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error executing remove-config command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al eliminar la configuración.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
