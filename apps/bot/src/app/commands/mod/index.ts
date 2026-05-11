import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import logger from "../../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Comandos de moderación")
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

  // subcomando: warn
  .addSubcommand((sub) =>
    sub
      .setName("warn")
      .setDescription("Advertir a un usuario")
      .addUserOption((o) =>
        o.setName("usuario").setDescription("Usuario a advertir").setRequired(true),
      )
      .addStringOption((o) =>
        o.setName("razon").setDescription("Razón de la advertencia").setRequired(false),
      ),
  )

  // subcomando: timeout
  .addSubcommand((sub) =>
    sub
      .setName("timeout")
      .setDescription("Silenciar temporalmente")
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
      .addStringOption((o) =>
        o.setName("duracion").setDescription("Duración (ej: 10m, 1h, 1d)").setRequired(true),
      )
      .addStringOption((o) => o.setName("razon").setDescription("Razón").setRequired(false)),
  )

  // subcomando: kick
  .addSubcommand((sub) =>
    sub
      .setName("kick")
      .setDescription("Expulsar usuario")
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
      .addStringOption((o) => o.setName("razon").setDescription("Razón").setRequired(false)),
  )

  // subcomando: ban
  .addSubcommand((sub) =>
    sub
      .setName("ban")
      .setDescription("Banear usuario")
      .addUserOption((o) => o.setName("usuario").setDescription("Usuario").setRequired(true))
      .addStringOption((o) => o.setName("razon").setDescription("Razón").setRequired(false))
      .addIntegerOption((o) =>
        o
          .setName("dias_eliminar")
          .setDescription("Días de mensajes a eliminar (0-7)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(7),
      ),
  )

  // subcomando: unban
  .addSubcommand((sub) =>
    sub
      .setName("unban")
      .setDescription("Desbanear usuario por ID")
      .addStringOption((o) =>
        o.setName("usuario_id").setDescription("ID del usuario").setRequired(true),
      )
      .addStringOption((o) => o.setName("razon").setDescription("Razón").setRequired(false)),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "warn": {
        const handler = await import("./warn.js");
        await handler.default(interaction);
        break;
      }
      case "timeout": {
        const handler = await import("./timeout.js");
        await handler.default(interaction);
        break;
      }
      case "kick": {
        const handler = await import("./kick.js");
        await handler.default(interaction);
        break;
      }
      case "ban": {
        const handler = await import("./ban.js");
        await handler.default(interaction);
        break;
      }
      case "unban": {
        const handler = await import("./unban.js");
        await handler.default(interaction);
        break;
      }
      default:
        await interaction.reply({
          content: "❌ Subcomando no reconocido",
          flags: [MessageFlags.Ephemeral],
        });
        break;
    }
  } catch (error) {
    logger.error("Error in /mod router", {
      subcommand,
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({
        content: "❌ Error interno al procesar el comando",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}
