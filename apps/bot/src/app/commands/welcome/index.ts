import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { execute as channel } from "./channel";
import { execute as message } from "./message";
import { execute as show } from "./show.js";
import { execute as test } from "./test.js";
import { execute as varRouter } from "./var/index.js";

export const data = new SlashCommandBuilder()
  .setName("welcome")
  .setDescription("Configura el sistema de bienvenida del servidor")

  // /welcome channel <#canal>
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Establece el canal de bienvenida")
      .addChannelOption((o) =>
        o.setName("canal").setDescription("Canal de bienvenida").setRequired(true),
      ),
  )

  // /welcome message
  .addSubcommand((sub) =>
    sub.setName("message").setDescription("Abre un modal para editar el mensaje de bienvenida"),
  )

  // /welcome show
  .addSubcommand((sub) =>
    sub.setName("show").setDescription("Muestra la configuración actual de bienvenida"),
  )

  // /welcome test
  .addSubcommand((sub) =>
    sub.setName("test").setDescription("Envía un mensaje de prueba al canal de bienvenida"),
  )

  // subcommand group: var
  .addSubcommandGroup((group) =>
    group
      .setName("var")
      .setDescription("Gestiona variables personalizadas de bienvenida")
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Establece una variable personalizada")
          .addStringOption((o) =>
            o.setName("nombre").setDescription("Nombre de la variable").setRequired(true),
          )
          .addStringOption((o) =>
            o.setName("valor").setDescription("Valor de la variable").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Elimina una variable personalizada")
          .addStringOption((o) =>
            o.setName("nombre").setDescription("Nombre de la variable").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("Lista todas las variables personalizadas"),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommandGroup = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  // Route to var subcommand group
  if (subcommandGroup === "var") {
    await varRouter(interaction);
    return;
  }

  // Direct subcommands
  switch (subcommand) {
    case "channel":
      await channel(interaction);
      break;
    case "message":
      await message(interaction);
      break;
    case "show":
      await show(interaction);
      break;
    case "test":
      await test(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}