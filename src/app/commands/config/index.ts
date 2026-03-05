import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} from "discord.js";

import { execute as setWelcome } from "./set-welcome";
import { execute as setVoiceLog } from "./set-voice-log";
import { execute as setLeaveLog } from "./set-leave-log";
import { execute as setImageChannel } from "./set-image-channel";
import { execute as show } from "./show";
import { execute as list } from "./list";
import { execute as remove } from "./remove";

export const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Comandos de configuración del servidor")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  // subcomando: set-welcome
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-welcome")
      .setDescription("Configurar el mensaje de bienvenida del servidor")
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription(
            "El canal donde se enviará el mensaje de bienvenida",
          )
          .setRequired(true),
      ),
  )

  // subcomando: set-voice-log
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-voice-log")
      .setDescription(
        "Configura el canal para registrar entrada/salida de canales de voz",
      )
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription("El canal donde se registrarán los logs de voz")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )

  // subcomando: set-leave-log
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-leave-log")
      .setDescription(
        "Configura el canal donde se enviarán logs cuando alguien salga del servidor",
      )
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription("Canal de logs de salida")
          .setRequired(true),
      ),
  )

  // subcomando: set-image-channel
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-image-channel")
      .setDescription("Configura el canal para reenviar imágenes")
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription("El canal donde se reenviarán las imágenes")
          .setRequired(true),
      ),
  )

  // subcomando: show
  .addSubcommand((subcommand) =>
    subcommand
      .setName("show")
      .setDescription("Muestra la configuración actual del servidor")
      .addBooleanOption((option) =>
        option
          .setName("publico")
          .setDescription("¿Mostrar la configuración públicamente?")
          .setRequired(false),
      ),
  )

  // subcomando: list
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription(
        "Lista todas las configuraciones de servidores (solo propietario)",
      ),
  )

  // subcomando: remove
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Elimina la configuración del servidor"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "set-welcome":
      await setWelcome(interaction);
      break;
    case "set-voice-log":
      await setVoiceLog(interaction);
      break;
    case "set-leave-log":
      await setLeaveLog(interaction);
      break;
    case "set-image-channel":
      await setImageChannel(interaction);
      break;
    case "show":
      await show(interaction);
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
