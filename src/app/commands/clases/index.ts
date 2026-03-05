import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getAllClasses } from "../../../config/repositories/ClassRolesRepo.ts";
import logger from "../../../utils/logger.ts";

import { execute as add } from "./add";
import { execute as list } from "./list";
import { execute as remove } from "./remove";

export const data = new SlashCommandBuilder()
  .setName("clases")
  .setDescription("Gestiona las clases del sistema de roles")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // subcomando: add
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
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
      ),
  )

  // subcomando: list
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription(
        "Lista todas las clases configuradas (solo administradores)",
      ),
  )

  // subcomando: remove
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription(
        "Elimina una clase del sistema (solo administradores)",
      )
      .addStringOption((option) =>
        option
          .setName("nombre")
          .setDescription("Nombre de la clase a eliminar")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "add":
      await add(interaction);
      break;
    case "list":
      await list(interaction);
      break;
    case "remove":
      await remove(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}

// Autocompletado para el nombre de clase (subcomando remove)
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
    logger.error("Error en autocompletado de clases remove", {
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.respond([]);
  }
}
