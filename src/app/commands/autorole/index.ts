import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { execute as setup } from "./setup";
import { execute as listar } from "./listar";
import { execute as editar } from "./editar";
import { execute as remover } from "./remover";

export const data = new SlashCommandBuilder()
  .setName("autorole")
  .setDescription("Sistema de asignación de roles automáticamente")
  //permisos
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // subcomandos
  // subcomando1: setup
  .addSubcommand((subcommand) =>
    subcommand
      .setName("setup")
      .setDescription("Configura roles automáticos con reacciones o botones")
      .addStringOption((option) =>
        option
          .setName("message_id")
          .setDescription("ID del mensaje")
          .setRequired(false),
      ),
  )

  //subcomando2: listar
  .addSubcommand((subcommand) =>
    subcommand
      .setName("listar")
      .setDescription("Lista los roles automáticos configurados"),
  )

  //subcomando3: editar
  .addSubcommand((subcommand) =>
    subcommand
      .setName("editar")
      .setDescription(
        "Edita el mensaje, rol, y botones de un mensaje configurado.",
      )
      .addStringOption((option) =>
        option
          .setName("message_id")
          .setDescription("ID del mensaje")
          .setRequired(true),
      ),
  )

  //subcomando4: remover
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remover")
      .setDescription("Elimina un mensaje configurado")
      .addStringOption((option) =>
        option
          .setName("message_id")
          .setDescription("ID del mensaje")
          .setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "setup":
      await setup(interaction);
      break;
    case "listar":
      await listar(interaction);
      break;
    case "editar":
      await editar(interaction);
      break;
    case "remover":
      await remover(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido",
        ephemeral: true,
      });
      break;
  }
}
