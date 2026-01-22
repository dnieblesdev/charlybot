import {
  SlashCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { removeClass, classExists, getAllClasses } from "../../config/repositories/ClassRolesRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("remove-class")
  .setDescription(
    "Elimina una clase del sistema (solo administradores)",
  )
  .addStringOption((option) =>
    option
      .setName("nombre")
      .setDescription("Nombre de la clase a eliminar")
      .setRequired(true)
      .setAutocomplete(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "remove-class",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ser usado en un servidor.",
        ephemeral: true,
      });
      return;
    }

    const className = interaction.options.getString("nombre", true);

    // Verificar si la clase existe
    const exists = await classExists(className);
    if (!exists) {
      await interaction.reply({
        content: `❌ La clase **${className}** no existe.\n\nUsa \`/list-classes\` para ver las clases configuradas.`,
        ephemeral: true,
      });
      return;
    }

    await removeClass(className);

    logger.info("Clase eliminada", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      className,
    });

    await interaction.reply({
      content: `✅ La clase **${className}** ha sido eliminada del sistema.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error ejecutando remove-class", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error eliminando la clase.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

// Autocompletado para el nombre de clase
export async function autocomplete(interaction: any) {
  try {
    const focusedValue = interaction.options.getFocused();
    const classes = await getAllClasses();

    const filtered = classes
      .filter((c) => c.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map((c) => ({ name: c.name, value: c.name }));

    await interaction.respond(filtered);
  } catch (error) {
    logger.error("Error en autocompletado de remove-class", {
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.respond([]);
  }
}
