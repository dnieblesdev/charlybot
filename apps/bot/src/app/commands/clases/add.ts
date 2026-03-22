import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { addClass, classExists } from "../../../config/repositories/ClassRolesRepo.ts";
import logger, { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "add-class");

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const className = interaction.options.getString("nombre", true);
    const classRole = interaction.options.getRole("rol-clase", true);
    const type = interaction.options.getString("tipo", true) as
      | "Healer"
      | "DPS"
      | "Tank";
    const typeRole = interaction.options.getRole("rol-tipo", true);
    const subclass1Name = interaction.options.getString("subclase1", true);
    const subclass1Role = interaction.options.getRole("rol-subclase1", true);
    const subclass2Name = interaction.options.getString("subclase2", true);
    const subclass2Role = interaction.options.getRole("rol-subclase2", true);

    // Verificar si la clase ya existe
    const exists = await classExists(interaction.guild.id, className);
    if (exists) {
      await interaction.reply({
        content: `❌ La clase **${className}** ya existe. Usa \`/remove-class\` primero si quieres reemplazarla.`,
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Crear la configuración de la clase
    const classConfig = {
      name: className,
      roleId: classRole.id,
      type,
      typeRoleId: typeRole.id,
      subclasses: [
        {
          name: subclass1Name,
          roleId: subclass1Role.id,
          guildId: interaction.guild.id,
        },
        {
          name: subclass2Name,
          roleId: subclass2Role.id,
          guildId: interaction.guild.id,
        },
      ],
      guildId: interaction.guild.id,
    };

    await addClass(interaction.guild.id, classConfig);

    logger.info("Clase añadida", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      className,
      type,
    });

    await interaction.reply({
      content:
        `✅ **Clase añadida exitosamente:**\n\n` +
        `📌 **Clase:** ${className} (${classRole})\n` +
        `🎯 **Tipo:** ${type} (${typeRole})\n` +
        `📋 **Subclases:**\n` +
        `   • ${subclass1Name} (${subclass1Role})\n` +
        `   • ${subclass2Name} (${subclass2Role})\n\n` +
        `Los usuarios ahora podrán seleccionar esta clase al verificarse.`,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    logger.error("Error ejecutando add-class", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error añadiendo la clase.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
