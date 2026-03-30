import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { execute as config } from "./config";
import { execute as levelRoles } from "./level-roles";
import { execute as rank } from "./rank";
import { execute as leaderboard } from "./leaderboard";

export const data = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("Sistema de XP y niveles del servidor")

  // subcommand group: config (verifica permisos en tiempo de ejecución)
  .addSubcommandGroup((group) =>
    group
      .setName("config")
      .setDescription("Configura el sistema de XP del servidor")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set-xp")
          .setDescription("Establece la cantidad de XP por mensaje")
          .addIntegerOption((option) =>
            option
              .setName("cantidad")
              .setDescription("XP ganado por mensaje (mínimo 1)")
              .setRequired(true)
              .setMinValue(1),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("enable").setDescription("Habilita el sistema de XP"),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("disable").setDescription("Deshabilita el sistema de XP"),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("show").setDescription("Muestra la configuración actual de XP"),
      ),
  )

  // subcommand group: level-roles (verifica permisos en tiempo de ejecución)
  .addSubcommandGroup((group) =>
    group
      .setName("level-roles")
      .setDescription("Gestiona roles por nivel")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Asocia un rol a un nivel")
          .addIntegerOption((option) =>
            option
              .setName("nivel")
              .setDescription("Nivel requerido")
              .setRequired(true)
              .setMinValue(1),
          )
          .addRoleOption((option) =>
            option
              .setName("rol")
              .setDescription("Rol que se dará al alcanzar el nivel")
              .setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("list").setDescription("Lista todos los roles por nivel"),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("remove")
          .setDescription("Elimina la asociación de rol para un nivel")
          .addIntegerOption((option) =>
            option
              .setName("nivel")
              .setDescription("Nivel cuya asociación quieres eliminar")
              .setRequired(true)
              .setMinValue(1),
          ),
      ),
  )

  // subcomando: rank
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rank")
      .setDescription("Muestra tu nivel y XP actual")
      .addUserOption((option) =>
        option
          .setName("usuario")
          .setDescription("Usuario del que quieres ver el rank (opcional)")
          .setRequired(false),
      ),
  )

  // subcomando: leaderboard
  .addSubcommand((subcommand) =>
    subcommand
      .setName("leaderboard")
      .setDescription("Muestra el top 10 de usuarios por XP en el servidor"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  // Route to config subcommands
  if (subcommandGroup === "config") {
    await config(interaction);
    return;
  }

  // Route to level-roles subcommands
  if (subcommandGroup === "level-roles") {
    await levelRoles(interaction);
    return;
  }

  // Direct subcommands
  switch (subcommand) {
    case "rank":
      await rank(interaction);
      break;
    case "leaderboard":
      await leaderboard(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}
