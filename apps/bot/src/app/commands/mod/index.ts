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
  )

  // subcomando: clear
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Eliminar mensajes en masa")
      .addIntegerOption((o) =>
        o.setName("cantidad").setDescription("Cantidad (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
      )
      .addUserOption((o) =>
        o.setName("usuario").setDescription("Filtrar por usuario").setRequired(false),
      ),
  )

  // subcomando: cases
  .addSubcommand((sub) =>
    sub
      .setName("cases")
      .setDescription("Ver historial de infracciones")
      .addUserOption((o) =>
        o.setName("usuario").setDescription("Usuario").setRequired(false),
      )
      .addIntegerOption((o) =>
        o.setName("id").setDescription("Número de caso específico").setRequired(false),
      ),
  )

  // subcomando: reason
  .addSubcommand((sub) =>
    sub
      .setName("reason")
      .setDescription("Actualizar razón de un caso")
      .addIntegerOption((o) =>
        o.setName("id").setDescription("Número de caso").setRequired(true),
      )
      .addStringOption((o) =>
        o.setName("razon").setDescription("Nueva razón").setRequired(true),
      ),
  )

  // grupo: config
  .addSubcommandGroup((group) =>
    group
      .setName("config")
      .setDescription("Configurar moderación")
      .addSubcommand((sub) =>
        sub
          .setName("mod-role")
          .setDescription("Rol de moderador")
          .addRoleOption((o) =>
            o.setName("rol").setDescription("Rol").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("mod-log")
          .setDescription("Canal de registro")
          .addChannelOption((o) =>
            o.setName("canal").setDescription("Canal").setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("warn-threshold")
          .setDescription("Configurar escalado de warns")
          .addIntegerOption((o) =>
            o.setName("warns").setDescription("Cantidad de warns").setRequired(true).setMinValue(1),
          )
          .addStringOption((o) =>
            o.setName("accion").setDescription("Acción").setRequired(true)
              .addChoices(
                { name: "Timeout", value: "timeout" },
                { name: "Kick", value: "kick" },
                { name: "Ban", value: "ban" },
              ),
          )
          .addStringOption((o) =>
            o.setName("duracion").setDescription("Duración (solo para timeout, ej: 1h)").setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("Ver configuración actual"),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const tEntry = Date.now();
  const subcommand = interaction.options.getSubcommand();

  try {
    // Defer immediately to prevent 3-second Discord timeout during dynamic import.
    // Placed inside try/catch so that "Unknown interaction" errors from Discord
    // are caught cleanly instead of propagating to the outer interaction handler.
    const tDefer = Date.now();
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const deferMs = Date.now() - tDefer;
    logger.debug("[mod] deferReply OK", {
      subcommand,
      deferMs,
      msSinceEntry: Date.now() - tEntry,
      interactionAge: Date.now() - interaction.createdTimestamp,
    });

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
      case "clear": {
        const handler = await import("./clear.js");
        await handler.default(interaction);
        break;
      }
      case "cases": {
        const handler = await import("./cases.js");
        await handler.default(interaction);
        break;
      }
      case "reason": {
        const handler = await import("./reason.js");
        await handler.default(interaction);
        break;
      }
      case "config": {
        const configSub = interaction.options.getSubcommand();
        const handler = await import(`./config/${configSub}.js`);
        await handler.default(interaction);
        break;
      }
      default: {
        // After deferReply, use editReply — reply() would fail on an already-deferred interaction.
        await interaction.editReply({
          content: "❌ Subcomando no reconocido",
        });
        break;
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Error in /mod router", {
      subcommand,
      error: errMsg,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      msSinceEntry: Date.now() - tEntry,
      interactionAge: Date.now() - interaction.createdTimestamp,
      wasDeferred: interaction.deferred,
      wasReplied: interaction.replied,
      isUnknownInteraction: errMsg === "Unknown interaction",
    });

    // Send a graceful error reply to the user.
    // - If deferReply succeeded: use followUp (token is still valid).
    // - If deferReply itself failed: try reply — it will likely fail too,
    //   but we handle that silently.
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ Error interno al procesar el comando.",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await interaction.reply({
          content: "❌ Error interno al procesar el comando.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error reply in /mod router", {
        error: replyError instanceof Error ? replyError.message : String(replyError),
        subcommand,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    }
  }
}
