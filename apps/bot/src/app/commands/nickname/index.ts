import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { execute as serverExec } from "./server.js";
import { execute as customExec } from "./custom.js";

export const data = new SlashCommandBuilder()
  .setName("nickname")
  .setDescription("Cambiar el apodo del bot en el servidor")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // subcomando: server
  .addSubcommand((subcommand) =>
    subcommand
      .setName("server")
      .setDescription("Establece el apodo del bot con el nombre del servidor"),
  )

  // subcomando: custom
  .addSubcommand((subcommand) =>
    subcommand
      .setName("custom")
      .setDescription("Establece un apodo personalizado para el bot")
      .addStringOption((option) =>
        option
          .setName("nombre")
          .setDescription("El nuevo apodo para el bot (máx. 32 caracteres)")
          .setRequired(true)
          .setMaxLength(32),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "server":
      await serverExec(interaction);
      break;
    case "custom":
      await customExec(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido.",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}