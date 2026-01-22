import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { addClass, classExists } from "../../config/repositories/ClassRolesRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("add-class")
  .setDescription(
    "Añade una clase con sus roles y subclases (solo administradores)",
  )
  .addStringOption((option) =>
    option
      .setName("nombre")
      .setDescription("Nombre de la clase (ej: Verdant Oracle)")
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option
      .setName("rol-clase")
      .setDescription("Rol de Discord para esta clase")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("tipo")
      .setDescription("Tipo de personaje")
      .setRequired(true)
      .addChoices(
        { name: "Healer", value: "Healer" },
        { name: "DPS", value: "DPS" },
        { name: "Tank", value: "Tank" },
      ),
  )
  .addRoleOption((option) =>
    option
      .setName("rol-tipo")
      .setDescription("Rol de Discord para el tipo (Healer/DPS/Tank)")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("subclase1")
      .setDescription("Nombre de la primera subclase (ej: Lifebind)")
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option
      .setName("rol-subclase1")
      .setDescription("Rol de Discord para la primera subclase")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("subclase2")
      .setDescription("Nombre de la segunda subclase (ej: Spiritbind)")
      .setRequired(true),
  )
  .addRoleOption((option) =>
    option
      .setName("rol-subclase2")
      .setDescription("Rol de Discord para la segunda subclase")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "add-class");

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        ephemeral: true,
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
    const exists = await classExists(className);
    if (exists) {
      await interaction.reply({
        content: `❌ La clase **${className}** ya existe. Usa \`/remove-class\` primero si quieres reemplazarla.`,
        ephemeral: true,
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
        },
        {
          name: subclass2Name,
          roleId: subclass2Role.id,
        },
      ],
    };

    await addClass(classConfig);

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
      ephemeral: true,
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
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
