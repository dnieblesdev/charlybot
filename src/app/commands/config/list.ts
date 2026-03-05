import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getAllGuildConfigs } from "../../../config/repositories/GuildConfigRepo.ts";
import { isOwnerInteraction } from "../../../utils/permissions.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "list-configs",
    );

    // Verificar que sea el propietario
    if (!isOwnerInteraction(interaction)) {
      logger.warn("Unauthorized list-configs attempt", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      await interaction.reply({
        content: "❌ Solo el propietario del bot puede usar este comando.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const configs = await getAllGuildConfigs();

    if (configs.length === 0) {
      logger.info("List configs executed - no configs found", {
        userId: interaction.user.id,
      });
      await interaction.reply({
        content: "📋 No hay configuraciones guardadas.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const configList = configs
      .map((config, index) => {
        return `${index + 1}. **Server ID:** ${config.guildId}\n   📍 Canal: <#${config.targetChannelId}>`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📋 Configuraciones de Servidores")
      .setDescription(configList)
      .setFooter({
        text: `Total: ${configs.length} servidor(es) configurado(s)`,
      })
      .setTimestamp();

    logger.info("List configs executed successfully", {
      userId: interaction.user.id,
      totalConfigs: configs.length,
    });

    await interaction.reply({
      embeds: [embed],
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    logger.error("Error executing list-configs command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al listar las configuraciones.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
