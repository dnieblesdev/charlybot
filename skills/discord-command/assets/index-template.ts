import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { execute as subcomando1 } from "./subcomando1";
// import { execute as subcomando2 } from "./subcomando2";

export const data = new SlashCommandBuilder()
  .setName("nombre")
  .setDescription("Descripción del comando")
  // Eliminar si el comando es para todos los usuarios:
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName("subcomando1").setDescription("Descripción del subcomando 1")
  );
// .addSubcommand((sub) =>
//   sub.setName("subcomando2").setDescription("Descripción del subcomando 2")
// );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  switch (subcommand) {
    case "subcomando1":
      await subcomando1(interaction);
      break;
    // case "subcomando2":
    //   await subcomando2(interaction);
    //   break;
    default:
      await interaction.reply({ content: "Comando no reconocido.", ephemeral: true });
  }
}
