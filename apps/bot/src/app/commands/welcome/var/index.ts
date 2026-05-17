import {
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";

import { execute as varSet } from "./set.js";
import { execute as varRemove } from "./remove.js";
import { execute as varList } from "./list.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "set":
      await varSet(interaction);
      break;
    case "remove":
      await varRemove(interaction);
      break;
    case "list":
      await varList(interaction);
      break;
    default:
      await interaction.reply({
        content: "Variable no reconocida",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}