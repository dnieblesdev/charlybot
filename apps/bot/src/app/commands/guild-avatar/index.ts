import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { execute as serverExec } from "./server.js";
import { execute as customExec } from "./custom.js";
import { execute as resetExec } from "./reset.js";

export const data = new SlashCommandBuilder()
  .setName("guild-avatar")
  .setDescription("Gestionar el avatar del bot específico para este servidor")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // subcomando: server
  .addSubcommand((subcommand) =>
    subcommand
      .setName("server")
      .setDescription("Establece el avatar del bot con el ícono del servidor"),
  )

  // subcomando: custom
  .addSubcommand((subcommand) =>
    subcommand
      .setName("custom")
      .setDescription("Establece un avatar personalizado para el bot")
      .addAttachmentOption((option) =>
        option
          .setName("imagen")
          .setDescription("La imagen para usar como avatar (PNG, JPG o GIF)")
          .setRequired(true),
      ),
  )

  // subcomando: reset
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reset")
      .setDescription("Elimina el avatar del servidor y vuelve al avatar global"),
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
    case "reset":
      await resetExec(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido.",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}