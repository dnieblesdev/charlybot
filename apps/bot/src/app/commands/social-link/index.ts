import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { listSocialLinks } from "../../../config/repositories/SocialLinkRepo.js";
import logger from "../../../utils/logger.js";

import { execute as setCmd } from "./set.js";
import { execute as removeCmd } from "./remove.js";
import { execute as listCmd } from "./list.js";

export const data = new SlashCommandBuilder()
  .setName("social-link")
  .setDescription("Gestiona los enlaces a redes sociales del servidor")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Añade o actualiza un enlace a una red social")
      .addStringOption((opt) =>
        opt
          .setName("plataforma")
          .setDescription("Nombre de la plataforma (ej: twitch, youtube, kick)")
          .setRequired(true)
          .setMinLength(1),
      )
      .addStringOption((opt) =>
        opt
          .setName("url")
          .setDescription("URL completa de la red social")
          .setRequired(true)
          .setMinLength(1),
      ),
  )

  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Elimina un enlace a una red social")
      .addStringOption((opt) =>
        opt
          .setName("plataforma")
          .setDescription("Plataforma a eliminar")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )

  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("Lista todos los enlaces a redes sociales configurados"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "set":
      await setCmd(interaction);
      break;
    case "remove":
      await removeCmd(interaction);
      break;
    case "list":
      await listCmd(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido.",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}

// Autocompletado para eliminar plataforma
export async function autocomplete(interaction: any) {
  try {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    if (!guildId) return await interaction.respond([]);

    const links = await listSocialLinks(guildId);

    const filtered = Array.from(links.entries())
      .filter(([platform]) =>
        platform.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25)
      .map(([platform, url]) => ({ name: `${platform} → ${url}`, value: platform }));

    await interaction.respond(filtered);
  } catch (error) {
    logger.error("Error en autocompletado de social-link remove", {
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.respond([]);
  }
}