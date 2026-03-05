import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";

import { execute as setup } from "./setup";
import { execute as panel } from "./panel";
import { execute as pendientes } from "./pendientes";

export const data = new SlashCommandBuilder()
  .setName("verificacion")
  .setDescription("Sistema de verificación de usuarios")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // subcomando: setup
  .addSubcommand((subcommand) =>
    subcommand
      .setName("setup")
      .setDescription(
        "Configura el sistema de verificación de usuarios (solo administradores)",
      )
      .addChannelOption((option) =>
        option
          .setName("verification-channel")
          .setDescription("Canal donde se mostrará el botón de verificación")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addChannelOption((option) =>
        option
          .setName("log-channel")
          .setDescription(
            "Canal donde se registrarán las verificaciones (solo logs)",
          )
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addRoleOption((option) =>
        option
          .setName("verified-role")
          .setDescription("Rol que se asignará a los usuarios verificados")
          .setRequired(true),
      ),
  )

  // subcomando: panel
  .addSubcommand((subcommand) =>
    subcommand
      .setName("panel")
      .setDescription(
        "Envía el panel de verificación al canal configurado (solo administradores)",
      ),
  )

  // subcomando: pendientes
  .addSubcommand((subcommand) =>
    subcommand
      .setName("pendientes")
      .setDescription(
        "Lista todas las solicitudes de verificación pendientes (solo administradores)",
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "setup":
      await setup(interaction);
      break;
    case "panel":
      await panel(interaction);
      break;
    case "pendientes":
      await pendientes(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}
