import {
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getAllClasses } from "../../../config/repositories/ClassRolesRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "list-classes",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const classes = await getAllClasses();

    if (classes.length === 0) {
      await interaction.editReply({
        content:
          "📋 No hay clases configuradas.\n\nUsa `/add-class` para añadir una clase.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎮 Clases Configuradas")
      .setDescription(
        `Hay **${classes.length}** clase(s) configurada(s) en el sistema.`,
      )
      .setColor(0x00ff00)
      .setTimestamp();

    for (const classConfig of classes) {
      const classRole = await interaction.guild.roles
        .fetch(classConfig.roleId)
        .catch(() => null);
      const typeRole = await interaction.guild.roles
        .fetch(classConfig.typeRoleId)
        .catch(() => null);

      let fieldValue = `**Tipo:** ${classConfig.type} ${typeRole ? `(${typeRole})` : `(ID: ${classConfig.typeRoleId})`}\n`;
      fieldValue += `**Rol de Clase:** ${classRole ? classRole : `ID: ${classConfig.roleId}`}\n`;
      fieldValue += `**Subclases:**\n`;

      for (const subclass of classConfig.subclasses) {
        const subclassRole = await interaction.guild.roles
          .fetch(subclass.roleId)
          .catch(() => null);
        fieldValue += `   • ${subclass.name} ${subclassRole ? `(${subclassRole})` : `(ID: ${subclass.roleId})`}\n`;
      }

      embed.addFields({
        name: `📌 ${classConfig.name}`,
        value: fieldValue,
        inline: false,
      });
    }

    logger.info("Clases listadas", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      classCount: classes.length,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error listando clases", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error listando las clases.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
