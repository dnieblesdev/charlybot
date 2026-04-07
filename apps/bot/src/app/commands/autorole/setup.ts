import {
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type RepliableInteraction,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import * as AutoRoleRepo from "../../../config/repositories/AutoRoleRepo.js";
import * as AutoRoleService from "../../services/AutoRoleService.js";
import { CUSTOM_IDS } from "../../interactions/customIds.ts";
import type { IAutoRole, IRoleMapping } from "@charlybot/shared";

interface SetupSession {
  guildId: string;
  /** Channel where the final autorole message will be created/edited */
  targetChannelId: string;
  /** Channel where the configuration UI message is posted */
  uiChannelId: string;
  messageId?: string;
  configMessageId?: string; // ID del mensaje de configuración (interfaz)
  messageAuthorIsBot: boolean; // true si el mensaje objetivo es del bot
  canEditMessage: boolean; // true si el bot puede editar el mensaje objetivo
  embedTitle?: string;
  embedDesc?: string;
  embedColor?: string;
  embedFooter?: string;
  embedThumb?: string;
  embedImage?: string;
  embedTimestamp?: boolean;
  embedAuthor?: string;
  mode: "multiple" | "unique";
  mappings: Array<{
    roleId: string;
    type: "reaction" | "button";
    emoji?: string;
    buttonLabel?: string;
    buttonStyle?: string;
    order: number;
  }>;
}

// Almacenamiento temporal de sesiones
const setupSessions = new Map<string, SetupSession>();

/**
 * Opens the interactive configuration UI for an existing AutoRole configuration.
 *
 * Used by `/autorole editar` to ensure it only edits already-configured messageIds.
 */
export async function openExistingAutoRoleEditor(
  interaction: RepliableInteraction,
  existingConfig: IAutoRole,
  params: {
    /** Channel where the original autorole message lives */
    targetChannelId: string;
    /** Channel where we show the configuration UI */
    uiChannelId: string;
    /** Whether the target message was authored by the bot */
    messageAuthorIsBot: boolean;
    /** Whether the bot can edit the target message */
    canEditMessage: boolean;
  },
): Promise<void> {
  const sessionId = interaction.user.id;

  setupSessions.set(sessionId, {
    guildId: existingConfig.guildId,
    targetChannelId: params.targetChannelId,
    uiChannelId: params.uiChannelId,
    messageId: existingConfig.messageId,
    messageAuthorIsBot: params.messageAuthorIsBot,
    canEditMessage: params.canEditMessage,
    embedTitle: existingConfig.embedTitle || undefined,
    embedDesc: existingConfig.embedDesc || undefined,
    embedColor: existingConfig.embedColor || undefined,
    embedFooter: existingConfig.embedFooter || undefined,
    embedThumb: existingConfig.embedThumb || undefined,
    embedImage: existingConfig.embedImage || undefined,
    embedTimestamp: existingConfig.embedTimestamp || undefined,
    embedAuthor: existingConfig.embedAuthor || undefined,
    mode: existingConfig.mode as "multiple" | "unique",
    mappings: (existingConfig.mappings as IRoleMapping[]).map((m) => ({
      roleId: m.roleId,
      type: m.type as "reaction" | "button",
      emoji: m.emoji || undefined,
      buttonLabel: m.buttonLabel || undefined,
      buttonStyle: m.buttonStyle || undefined,
      order: m.order,
    })),
  });

  await showConfigurationInterface(interaction, sessionId);
  startCollector(interaction, sessionId);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "autorole-setup",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const messageId = interaction.options.getString("message_id");
    const targetChannel = interaction.options.getChannel("canal");

    // Verificar permisos del bot
    const botMember = await interaction.guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content:
          "❌ No tengo permisos para gestionar roles. Por favor, otórgame el permiso `MANAGE_ROLES`.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Si se proporciona message_id, verificar que existe
    if (messageId) {
      try {
        const channel = interaction.channel;
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({
            content: "❌ Este comando debe ejecutarse en un canal de texto.",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        const message = await channel.messages.fetch(messageId);
        if (!message) {
          await interaction.reply({
            content: "❌ No pude encontrar ese mensaje en este canal.",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        // Determine if the bot can edit this message
        // Bot can only edit its own messages
        const botMember = await interaction.guild.members.fetchMe();
        const messageAuthorIsBot = message.author.id === botMember.user.id;
        const canEditMessage = messageAuthorIsBot;

        // Verificar si ya existe una configuración para este mensaje
        const existingConfig =
          await AutoRoleRepo.getAutoRoleByMessageId(interaction.guild.id, messageId);

        const sessionId = interaction.user.id;

        if (existingConfig) {
          // Cargar configuración existente
          logger.info("Loading existing autorole config", {
            messageId,
            autoRoleId: existingConfig.id,
            mappingsCount: existingConfig.mappings.length,
          });

          setupSessions.set(sessionId, {
            guildId: interaction.guild.id,
            targetChannelId: interaction.channelId,
            uiChannelId: interaction.channelId,
            messageId: messageId,
            messageAuthorIsBot,
            canEditMessage,
            embedTitle: existingConfig.embedTitle || undefined,
            embedDesc: existingConfig.embedDesc || undefined,
            embedColor: existingConfig.embedColor || undefined,
            embedFooter: existingConfig.embedFooter || undefined,
            embedThumb: existingConfig.embedThumb || undefined,
            embedImage: existingConfig.embedImage || undefined,
            embedTimestamp: existingConfig.embedTimestamp || undefined,
            embedAuthor: existingConfig.embedAuthor || undefined,
            mode: existingConfig.mode as "multiple" | "unique",
            mappings: (existingConfig.mappings as IRoleMapping[]).map((m) => ({
              roleId: m.roleId,
              type: m.type as "reaction" | "button",
              emoji: m.emoji || undefined,
              buttonLabel: m.buttonLabel || undefined,
              buttonStyle: m.buttonStyle || undefined,
              order: m.order,
            })),
          });

          // Defer reply so showConfigurationInterface can use editReply
          await interaction.deferReply();
        } else {
          // Crear sesión nueva con mensaje existente
          logger.info("Creating new autorole config for existing message", {
            messageId,
            messageAuthorIsBot,
            canEditMessage,
          });

          setupSessions.set(sessionId, {
            guildId: interaction.guild.id,
            targetChannelId: interaction.channelId,
            uiChannelId: interaction.channelId,
            messageId: messageId,
            messageAuthorIsBot,
            canEditMessage,
            mode: "multiple",
            mappings: [],
          });

          // Defer reply so showConfigurationInterface can use editReply
          await interaction.deferReply();
        }

        await showConfigurationInterface(interaction, sessionId);

        // Iniciar collector global para esta sesión
        startCollector(interaction, sessionId);
      } catch (error) {
        logger.error("Error fetching message", {
          error: error instanceof Error ? error.message : String(error),
          messageId,
        });
        await interaction.reply({
          content: "❌ No pude encontrar ese mensaje. Verifica el ID.",
          flags: [MessageFlags.Ephemeral],
        });
      }
     } else {
       // Crear sesión nueva (sin messageId) y permitir elegir canal destino
       const sessionId = interaction.user.id;

       const resolvedChannelId =
         targetChannel &&
         (targetChannel.type === ChannelType.GuildText ||
           targetChannel.type === ChannelType.GuildAnnouncement)
           ? targetChannel.id
           : interaction.channelId;

       setupSessions.set(sessionId, {
         guildId: interaction.guild.id,
         targetChannelId: resolvedChannelId,
         uiChannelId: interaction.channelId,
         messageAuthorIsBot: true,
         canEditMessage: true,
         mode: "multiple",
         mappings: [],
       });

       // Mostrar modal para crear nuevo mensaje
       await showInitialModal(interaction);
     }
  } catch (error) {
    logger.error("Error executing autorole-setup command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al configurar el sistema de auto-roles. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}

/**
 * Muestra el modal inicial para crear un nuevo mensaje
 */
async function showInitialModal(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_IDS.autorole.modal.INITIAL)
    .setTitle("Configurar Auto-Roles");

  const titleInput = new TextInputBuilder()
    .setCustomId("embed_title")
    .setLabel("Título del Embed")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ej: Selecciona tus roles")
    .setRequired(true)
    .setMaxLength(256);

  const descInput = new TextInputBuilder()
    .setCustomId("embed_desc")
    .setLabel("Descripción del Embed")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Ej: Reacciona o presiona un botón para obtener un rol")
    .setRequired(true)
    .setMaxLength(4000);

  const modeInput = new TextInputBuilder()
    .setCustomId("mode")
    .setLabel("Modo (multiple o unique)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("multiple = varios roles, unique = solo uno")
    .setRequired(true)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      titleInput,
    ),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      descInput,
    ),
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      modeInput,
    ),
  );

  await interaction.showModal(modal);
}

/**
 * Builds the configuration embed for a session.
 */
async function buildConfigEmbed(
  session: SetupSession,
  guild: { roles: { fetch: (id: string) => Promise<{ name: string } | null> } },
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setTitle("⚙️ Configuración de Auto-Roles")
    .setColor(0x5865f2)
    .addFields(
      {
        name: "Modo",
        value:
          session.mode === "multiple"
            ? "Múltiples roles (usuarios pueden tener varios)"
            : "Rol único (solo pueden tener uno)",
        inline: true,
      },
      {
        name: "Roles configurados",
        value:
          session.mappings.length > 0
            ? `${session.mappings.length}/10`
            : "Ninguno",
        inline: true,
      },
    );

  // Agregar lista de roles configurados
  if (session.mappings.length > 0) {
    let mappingsText = "";
    for (let i = 0; i < session.mappings.length; i++) {
      const mapping = session.mappings[i];
      if (!mapping) continue;
      const role = await guild.roles.fetch(mapping.roleId);
      const identifier =
        mapping.type === "reaction"
          ? mapping.emoji || "❓"
          : `🔘 ${mapping.buttonLabel || "Sin nombre"}`;
      mappingsText += `${i + 1}. ${identifier} → ${role?.name || "Rol desconocido"}\n`;
    }
    embed.addFields({
      name: "Configuración actual",
      value: mappingsText.substring(0, 1024),
    });
  }

  if (session.embedTitle) {
    embed.addFields({
      name: "Vista previa del mensaje",
      value: `**${session.embedTitle}**\n${session.embedDesc}`,
    });
  }

  return embed;
}

/**
 * Builds the configuration button rows for a session.
 */
function buildConfigComponents(session: SetupSession): ActionRowBuilder<ButtonBuilder>[] {
  const canEdit = session.canEditMessage;

  // Row 1: Add, Edit (conditional), Remove
  const row1Components: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.ADD_MAPPING)
      .setLabel("➕ Agregar Rol")
      .setStyle(ButtonStyle.Success)
      .setDisabled(session.mappings.length >= 10),
  ];

  if (canEdit) {
    row1Components.push(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.autorole.config.EDIT_MAPPING)
        .setLabel("✏️ Editar")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(session.mappings.length === 0),
    );
  }

  row1Components.push(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.REMOVE_MAPPING)
      .setLabel("🗑️ Eliminar")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(session.mappings.length === 0),
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(row1Components);

  // Row 2: Toggle mode, Customize (conditional), Finish, Cancel
  const row2Components: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.TOGGLE_MODE)
      .setLabel("🔄 Cambiar Modo")
      .setStyle(ButtonStyle.Secondary),
  ];

  if (canEdit) {
    row2Components.push(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.autorole.config.CUSTOMIZE_EMBED)
        .setLabel("⚙️ Personalizar Embed")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  row2Components.push(
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.FINISH)
      .setLabel("✅ Finalizar")
      .setStyle(ButtonStyle.Success)
      .setDisabled(session.mappings.length === 0),
    new ButtonBuilder()
      .setCustomId(CUSTOM_IDS.autorole.config.CANCEL)
      .setLabel("❌ Cancelar")
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(row2Components);

  return [row1, row2];
}

/**
 * Muestra la interfaz de configuración interactiva
 */
async function showConfigurationInterface(
  interaction: RepliableInteraction,
  sessionId: string,
) {
  const session = setupSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Sesión no encontrada. Inicia de nuevo.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const embed = await buildConfigEmbed(session, interaction.guild!);
  const components = buildConfigComponents(session);

  if (interaction.replied || interaction.deferred) {
    const reply = await interaction.editReply({
      embeds: [embed],
      components,
    });
    // Guardar el ID del mensaje de configuración
    if (reply && reply.id) {
      session.configMessageId = reply.id;
      setupSessions.set(sessionId, session);
    }
  } else {
    const reply = await interaction.reply({
      embeds: [embed],
      components,
      fetchReply: true,
    });
    // Guardar el ID del mensaje de configuración
    if (reply && typeof reply === "object" && "id" in reply) {
      session.configMessageId = reply.id;
      setupSessions.set(sessionId, session);
    }
  }
}

/**
 * Maneja agregar un nuevo mapping
 */
async function handleAddMapping(
  interaction: ButtonInteraction,
  sessionId: string,
) {
  const session = setupSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Sesión no encontrada.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_IDS.autorole.modal.ADD_MAPPING)
    .setTitle("Agregar Rol");

  // Si el bot no puede editar el mensaje, solo permitir reacciones
  const canEdit = session.canEditMessage;

  if (!canEdit) {
    // Modal simplificado solo para reacciones
    const emojiInput = new TextInputBuilder()
      .setCustomId("emoji_or_label")
      .setLabel("Emoji para reacción")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("😀")
      .setRequired(true);

    const roleIdInput = new TextInputBuilder()
      .setCustomId("role_id")
      .setLabel("ID del Rol")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("ID del rol de Discord")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        emojiInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        roleIdInput,
      ),
    );
  } else {
    // Modal completo para botones y reacciones
    const typeInput = new TextInputBuilder()
      .setCustomId("type")
      .setLabel("Tipo (reaction o button)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("reaction o button")
      .setRequired(true);

    const emojiOrLabelInput = new TextInputBuilder()
      .setCustomId("emoji_or_label")
      .setLabel("Emoji (para reaction) o Label (para button)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("😀 o Mi Rol")
      .setRequired(true);

    const roleIdInput = new TextInputBuilder()
      .setCustomId("role_id")
      .setLabel("ID del Rol")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("ID del rol de Discord")
      .setRequired(true);

    const buttonStyleInput = new TextInputBuilder()
      .setCustomId("button_style")
      .setLabel("Color del botón (solo si es button)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("PRIMARY, SECONDARY, SUCCESS, DANGER")
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        typeInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        emojiOrLabelInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        roleIdInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        buttonStyleInput,
      ),
    );
  }

  await interaction.showModal(modal);
}

/**
 * Handles configuration button interactions directly (not via collector).
 * This is needed because ephemeral messages don't trigger channel collectors.
 */
export async function handleConfigButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const sessionId = interaction.user.id;
  const session = setupSessions.get(sessionId);

  // Defense in depth: block edit/customize if bot can't edit the message
  if (session) {
    if (
      (interaction.customId === CUSTOM_IDS.autorole.config.EDIT_MAPPING ||
        interaction.customId === CUSTOM_IDS.autorole.config.CUSTOMIZE_EMBED) &&
      !session.canEditMessage
    ) {
      await interaction.reply({
        content:
          "❌ No puedes editar ni personalizar este mensaje porque pertenece a otro usuario. Solo puedes agregar reacciones.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
  }

  if (interaction.customId === CUSTOM_IDS.autorole.config.ADD_MAPPING) {
    await handleAddMapping(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.config.EDIT_MAPPING) {
    await handleEditMapping(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.config.REMOVE_MAPPING) {
    await handleRemoveMapping(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.config.TOGGLE_MODE) {
    await handleToggleMode(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.config.CUSTOMIZE_EMBED) {
    await handleCustomizeEmbed(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.config.FINISH) {
    await handleFinish(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.config.CANCEL) {
    try {
      logger.info("Cancelling autorole setup", {
        sessionId,
        userId: interaction.user.id,
      });
      setupSessions.delete(sessionId);
      await interaction.update({
        content: "❌ Configuración cancelada.",
        embeds: [],
        components: [],
      });
      logger.info("Autorole setup cancelled successfully", { sessionId });
    } catch (cancelError) {
      logger.error("Error cancelling autorole setup", {
        error:
          cancelError instanceof Error
            ? cancelError.message
            : String(cancelError),
        stack: cancelError instanceof Error ? cancelError.stack : undefined,
        sessionId,
        userId: interaction.user.id,
      });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error al cancelar la configuración.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  } else {
    logger.warn("autorole.setup: unknown config button", {
      customId: interaction.customId,
      sessionId,
    });
  }
}

/**
 * Inicia el collector global para una sesión
 * NOTE: This is kept for backwards compatibility but config buttons are now
 * handled directly via handleConfigButton since collectors don't see
 * interactions on ephemeral messages.
 */
function startCollector(interaction: RepliableInteraction, sessionId: string) {
  // Config buttons are now handled directly in the handler, not via collector.
  // The collector is only used for select menus that might appear in non-ephemeral messages.
  // For now, we keep this as a no-op to avoid breaking existing flows.
  logger.info("startCollector called (config buttons handled directly now)", {
    sessionId,
  });
}

/**
 * Maneja editar un mapping existente
 */
async function handleEditMapping(
  interaction: ButtonInteraction,
  sessionId: string,
) {
  const session = setupSessions.get(sessionId);
  if (!session || session.mappings.length === 0) {
    await interaction.reply({
      content: "❌ No hay roles para editar.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const options = session.mappings.map((mapping, index) => {
    const identifier =
      mapping.type === "reaction"
        ? mapping.emoji || "❓"
        : `🔘 ${mapping.buttonLabel || "Sin nombre"}`;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${index + 1}. ${identifier}`)
      .setValue(index.toString())
      .setDescription(`Rol ID: ${mapping.roleId}`);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.autorole.select.EDIT)
    .setPlaceholder("Selecciona un rol para editar")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );

  await interaction.reply({
    content: "Selecciona el rol que deseas editar:",
    components: [row],
    flags: [MessageFlags.Ephemeral],
  });
}

/**
 * Maneja eliminar un mapping
 */
async function handleRemoveMapping(
  interaction: ButtonInteraction,
  sessionId: string,
) {
  const session = setupSessions.get(sessionId);
  if (!session || session.mappings.length === 0) {
    await interaction.reply({
      content: "❌ No hay roles para eliminar.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  const options = session.mappings.map((mapping, index) => {
    const identifier =
      mapping.type === "reaction"
        ? mapping.emoji || "❓"
        : `🔘 ${mapping.buttonLabel || "Sin nombre"}`;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${index + 1}. ${identifier}`)
      .setValue(index.toString())
      .setDescription(`Rol ID: ${mapping.roleId}`);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.autorole.select.REMOVE)
    .setPlaceholder("Selecciona un rol para eliminar")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );

  await interaction.reply({
    content: "Selecciona el rol que deseas eliminar:",
    components: [row],
    flags: [MessageFlags.Ephemeral],
  });
}

/**
 * Maneja la personalización del embed
 */
async function handleCustomizeEmbed(
  interaction: ButtonInteraction,
  sessionId: string,
) {
  try {
    logger.info("handleCustomizeEmbed called", {
      sessionId,
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
    });

    const session = setupSessions.get(sessionId);
    if (!session) {
      logger.warn("Session not found in handleCustomizeEmbed", { sessionId });
      await interaction.reply({
        content: "❌ Sesión no encontrada. Inicia de nuevo.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    logger.info("Building customize modal", {
      sessionId,
      currentValues: {
        color: session.embedColor,
        footer: session.embedFooter,
        thumb: session.embedThumb,
        image: session.embedImage,
        author: session.embedAuthor,
      },
    });

    const modalCustomId = CUSTOM_IDS.autorole.modal.CUSTOMIZE(sessionId);
    logger.info("Creating modal with customId", { modalCustomId, sessionId });

    const modal = new ModalBuilder()
      .setCustomId(modalCustomId)
      .setTitle("Personalizar Embed");

    const colorInput = new TextInputBuilder()
      .setCustomId("embedColor")
      .setLabel("Color del Embed (hex)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("#5865F2")
      .setValue(session.embedColor || "")
      .setRequired(false);

    const footerInput = new TextInputBuilder()
      .setCustomId("embedFooter")
      .setLabel("Texto del Footer")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Selecciona tus roles")
      .setValue(session.embedFooter || "")
      .setRequired(false);

    const thumbInput = new TextInputBuilder()
      .setCustomId("embedThumb")
      .setLabel("URL de la Thumbnail")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://ejemplo.com/imagen.png")
      .setValue(session.embedThumb || "")
      .setRequired(false);

    const imageInput = new TextInputBuilder()
      .setCustomId("embedImage")
      .setLabel("URL de la Imagen")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://ejemplo.com/banner.png")
      .setValue(session.embedImage || "")
      .setRequired(false);

    const authorInput = new TextInputBuilder()
      .setCustomId("embedAuthor")
      .setLabel("Texto del Autor")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Sistema de Roles")
      .setValue(session.embedAuthor || "")
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        colorInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        footerInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        thumbInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        imageInput,
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        authorInput,
      ),
    );

    logger.info("Showing customize modal", { sessionId });

    await interaction.showModal(modal);

    logger.info("Customize modal shown successfully", { sessionId });
  } catch (error) {
    logger.error("Error in handleCustomizeEmbed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId,
      userId: interaction.user.id,
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Error al mostrar el formulario de personalización.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}

/**
 * Maneja cambiar el modo
 */
async function handleToggleMode(
  interaction: ButtonInteraction,
  sessionId: string,
) {
  const session = setupSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Sesión no encontrada.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  session.mode = session.mode === "multiple" ? "unique" : "multiple";
  setupSessions.set(sessionId, session);

  // Actualizar el mensaje con la nueva configuración
  const embed = await buildConfigEmbed(session, interaction.guild!);
  const components = buildConfigComponents(session);

  await interaction.update({
    embeds: [embed],
    components,
  });
}

/**
 * Maneja finalizar la configuración
 */
async function handleFinish(
  interaction: ButtonInteraction,
  sessionId: string,
) {
  const session = setupSessions.get(sessionId);
  if (!session) {
    await interaction.reply({
      content: "❌ Sesión no encontrada.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    let baselineAutoRole:
      | Awaited<ReturnType<typeof AutoRoleRepo.getAutoRoleByMessageId>>
      | null
      | undefined;

    // If we are editing an existing configured message and nothing changed,
    // do NOTHING (no Discord message edits, no DB writes).
    if (session.messageId) {
      baselineAutoRole = await AutoRoleRepo.getAutoRoleByMessageId(
        session.guildId,
        session.messageId,
      );

      const norm = (v: unknown): string =>
        typeof v === "string" ? v : v == null ? "" : String(v);
      const normOpt = (v: unknown): string => {
        const s = norm(v);
        return s.length === 0 ? "" : s;
      };
      const normBool = (v: unknown): boolean => Boolean(v);
      const normStyle = (v: unknown): string => norm(v).toUpperCase();

      const serializeMappings = (
        mappings: Array<{
          roleId: string;
          type: string;
          emoji?: string | null;
          buttonLabel?: string | null;
          buttonStyle?: string | null;
          order: number;
        }>,
      ): string => {
        return mappings
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(
            (m) =>
              [
                norm(m.roleId),
                norm(m.type),
                normOpt(m.emoji),
                normOpt(m.buttonLabel),
                normStyle(m.buttonStyle),
                String(m.order ?? 0),
              ].join("|"),
          )
          .join("\n");
      };

      if (baselineAutoRole) {
        const sessionMappings = session.mappings.map((m) => ({
          roleId: m.roleId,
          type: m.type,
          emoji: m.emoji ?? null,
          buttonLabel: m.buttonLabel ?? null,
          buttonStyle: m.buttonStyle ?? null,
          order: m.order,
        }));

        const existingMappings = (baselineAutoRole.mappings as IRoleMapping[]).map(
          (m) => ({
            roleId: m.roleId,
            type: m.type,
            emoji: m.emoji ?? null,
            buttonLabel: m.buttonLabel ?? null,
            buttonStyle: m.buttonStyle ?? null,
            order: m.order,
          }),
        );

        const dirty =
          baselineAutoRole.mode !== session.mode ||
          normOpt(baselineAutoRole.embedTitle) !== normOpt(session.embedTitle) ||
          normOpt(baselineAutoRole.embedDesc) !== normOpt(session.embedDesc) ||
          normOpt(baselineAutoRole.embedColor) !== normOpt(session.embedColor) ||
          normOpt(baselineAutoRole.embedFooter) !== normOpt(session.embedFooter) ||
          normOpt(baselineAutoRole.embedThumb) !== normOpt(session.embedThumb) ||
          normOpt(baselineAutoRole.embedImage) !== normOpt(session.embedImage) ||
          normBool(baselineAutoRole.embedTimestamp) !==
            normBool(session.embedTimestamp) ||
          normOpt(baselineAutoRole.embedAuthor) !== normOpt(session.embedAuthor) ||
          serializeMappings(existingMappings) !== serializeMappings(sessionMappings);

        if (!dirty) {
          await interaction.editReply({
            content: "ℹ️ No hay cambios para guardar.",
            embeds: [],
            components: [],
          });
          setupSessions.delete(sessionId);
          return;
        }
      }
    }

    // Validar configuración
    const validation = await AutoRoleService.validateConfiguration(
      interaction.guild!,
      session.mappings,
    );

    if (!validation.valid) {
      await interaction.editReply({
        content: `❌ Errores en la configuración:\n${validation.errors.join("\n")}`,
        embeds: [],
        components: [],
      });
      return;
    }

    let message;
    let channelId = session.targetChannelId;

    // Si no hay messageId, crear nuevo mensaje
    if (!session.messageId) {
      const channel = await interaction.guild!.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({
          content: "❌ Canal no válido.",
          embeds: [],
          components: [],
        });
        return;
      }

      const result = await AutoRoleService.createMessageWithRoles(
        channel as any,
        {
          embedTitle: session.embedTitle!,
          embedDesc: session.embedDesc!,
          embedColor: session.embedColor,
          embedFooter: session.embedFooter,
          embedThumb: session.embedThumb,
          embedImage: session.embedImage,
          embedTimestamp: session.embedTimestamp,
          embedAuthor: session.embedAuthor,
          mappings: session.mappings,
        },
      );

      if (!result.success || !result.message) {
        await interaction.editReply({
          content: `❌ ${result.error || "Error al crear el mensaje."}`,
          embeds: [],
          components: [],
        });
        return;
      }

      message = result.message;
      session.messageId = message.id;
    } else if (!session.canEditMessage) {
      // El mensaje es de un usuario, el bot no puede editarlo
      // Solo agregar reacciones al mensaje existente
      logger.info("User message - adding reactions only", {
        sessionId,
        messageId: session.messageId,
        mappingsCount: session.mappings.length,
      });

      const channel = await interaction.guild!.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({
          content: "❌ Canal no válido.",
          embeds: [],
          components: [],
        });
        return;
      }

      message = await (channel as any).messages.fetch(session.messageId);

      // Solo agregar reacciones para mappings de tipo "reaction"
      const reactionMappings = session.mappings.filter((m) => m.type === "reaction");

      for (const mapping of reactionMappings) {
        if (mapping.emoji) {
          try {
            // Intentar parsear el emoji para reacción
            // Puede ser un emoji unicode o un emoji personalizado
            await message.react(mapping.emoji);
            logger.info("Reaction added", {
              messageId: session.messageId,
              emoji: mapping.emoji,
              roleId: mapping.roleId,
            });
          } catch (reactError) {
            logger.error("Error adding reaction", {
              error: reactError instanceof Error ? reactError.message : String(reactError),
              emoji: mapping.emoji,
              messageId: session.messageId,
            });
          }
        }
      }
    } else {
      // Actualizar mensaje existente (del bot)
      const channel = await interaction.guild!.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({
          content: "❌ Canal no válido.",
          embeds: [],
          components: [],
        });
        return;
      }

      message = await (channel as any).messages.fetch(session.messageId);
      const result = await AutoRoleService.updateMessageWithRoles(message, {
        embedTitle: session.embedTitle,
        embedDesc: session.embedDesc,
        embedColor: session.embedColor,
        embedFooter: session.embedFooter,
        embedThumb: session.embedThumb,
        embedImage: session.embedImage,
        embedTimestamp: session.embedTimestamp,
        embedAuthor: session.embedAuthor,
        mappings: session.mappings,
      });

      if (!result.success) {
        await interaction.editReply({
          content: `❌ ${result.error || "Error al actualizar el mensaje."}`,
          embeds: [],
          components: [],
        });
        return;
      }
    }

    // Verificar si ya existe una configuración para este mensaje
    const existingAutoRole =
      baselineAutoRole ??
      (await AutoRoleRepo.getAutoRoleByMessageId(
        session.guildId,
        session.messageId!,
      ));

    let autoRoleId: number;

    if (existingAutoRole) {
      // Actualizar configuración existente
      logger.info("Updating existing autorole config", {
        autoRoleId: existingAutoRole.id,
        messageId: session.messageId,
      });

      await AutoRoleRepo.updateAutoRole(session.guildId, existingAutoRole.id, {
        mode: session.mode,
        embedTitle: session.embedTitle,
        embedDesc: session.embedDesc,
        embedColor: session.embedColor,
        embedFooter: session.embedFooter,
        embedThumb: session.embedThumb,
        embedImage: session.embedImage,
        embedTimestamp: session.embedTimestamp,
        embedAuthor: session.embedAuthor,
      });

      // Eliminar mappings anteriores
      await AutoRoleRepo.removeAllRoleMappings(session.guildId, existingAutoRole.id);
      autoRoleId = existingAutoRole.id;
    } else {
      // Crear nueva configuración
      logger.info("Creating new autorole config", {
        messageId: session.messageId,
      });

      const autoRole = await AutoRoleRepo.createAutoRole(session.guildId, {
        guildId: session.guildId,
        channelId,
        messageId: session.messageId!,
        mode: session.mode,
        embedTitle: session.embedTitle,
        embedDesc: session.embedDesc,
        embedColor: session.embedColor,
        embedFooter: session.embedFooter,
        embedThumb: session.embedThumb,
        embedImage: session.embedImage,
        embedTimestamp: session.embedTimestamp,
        embedAuthor: session.embedAuthor,
        createdBy: interaction.user.id,
        mappings: [], // Se agregan después
      });
      autoRoleId = autoRole.id;
    }

    // Guardar mappings
    for (const mapping of session.mappings) {
      await AutoRoleRepo.addRoleMapping(session.guildId, autoRoleId, {
        roleId: mapping.roleId,
        type: mapping.type,
        emoji: mapping.emoji,
        buttonLabel: mapping.buttonLabel,
        buttonStyle: mapping.buttonStyle,
        order: mapping.order,
      });
    }

    await interaction.editReply({
      content: `✅ Auto-roles configurado exitosamente!\n🔗 [Ver mensaje](https://discord.com/channels/${session.guildId}/${channelId}/${session.messageId})`,
      embeds: [],
      components: [],
    });

    setupSessions.delete(sessionId);
  } catch (error) {
    logger.error("Error finishing autorole setup", {
      error: error instanceof Error ? error.message : String(error),
      sessionId,
    });
    await interaction.editReply({
      content: "❌ Error al guardar la configuración.",
      embeds: [],
      components: [],
    });
  }
}

// Event listener para modales
export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  if (interaction.customId === CUSTOM_IDS.autorole.modal.INITIAL) {
    const embedTitle = interaction.fields.getTextInputValue("embed_title");
    const embedDesc = interaction.fields.getTextInputValue("embed_desc");
    const modeInput = interaction.fields
      .getTextInputValue("mode")
      .toLowerCase();

    if (modeInput !== "multiple" && modeInput !== "unique") {
      await interaction.reply({
        content: '❌ Modo inválido. Usa "multiple" o "unique".',
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const sessionId = interaction.user.id;

    const existing = setupSessions.get(sessionId);
    if (existing) {
      // Session may have been pre-created by /autorole setup with a target channel.
      existing.embedTitle = embedTitle;
      existing.embedDesc = embedDesc;
      existing.mode = modeInput as "multiple" | "unique";
      existing.messageAuthorIsBot = true;
      existing.canEditMessage = true;
      setupSessions.set(sessionId, existing);
    } else {
      logger.info("Creating new session", {
        sessionId,
        userId: interaction.user.id,
        guildId: interaction.guild!.id,
      });

      if (!interaction.channelId) {
        await interaction.reply({
          content: "❌ No se pudo determinar el canal.",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      setupSessions.set(sessionId, {
        guildId: interaction.guild!.id,
        targetChannelId: interaction.channelId,
        uiChannelId: interaction.channelId,
        messageAuthorIsBot: true, // Bot will create the message, so it can edit it
        canEditMessage: true,
        embedTitle,
        embedDesc,
        mode: modeInput as "multiple" | "unique",
        mappings: [],
      });
    }

    logger.info("Session created and stored", {
      sessionId,
      totalSessions: setupSessions.size,
      allSessions: Array.from(setupSessions.keys()),
    });

    await interaction.deferReply();
    await showConfigurationInterface(interaction, sessionId);

    // Iniciar collector global para esta sesión
    startCollector(interaction, sessionId);
  } else if (interaction.customId === CUSTOM_IDS.autorole.modal.ADD_MAPPING) {
    const sessionId = interaction.user.id;
    const session = setupSessions.get(sessionId);
    if (!session) {
      await interaction.reply({
        content: "❌ Sesión no encontrada.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Determinar el tipo según si el bot puede editar el mensaje
    let type: "reaction" | "button";
    let emojiOrLabel: string;
    let roleId: string;
    let buttonStyle: string;

    if (!session.canEditMessage) {
      // Modal simplificado: solo emoji y role_id
      type = "reaction";
      emojiOrLabel = interaction.fields.getTextInputValue("emoji_or_label");
      roleId = interaction.fields.getTextInputValue("role_id");
      buttonStyle = "PRIMARY";
    } else {
      // Modal completo: tipo, emoji/label, role_id, button_style
      const typeInput = interaction.fields.getTextInputValue("type").toLowerCase();
      if (typeInput !== "reaction" && typeInput !== "button") {
        await interaction.reply({
          content: '❌ Tipo inválido. Usa "reaction" o "button".',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }
      type = typeInput as "reaction" | "button";
      emojiOrLabel = interaction.fields.getTextInputValue("emoji_or_label");
      roleId = interaction.fields.getTextInputValue("role_id");
      buttonStyle =
        interaction.fields.getTextInputValue("button_style") || "PRIMARY";
    }

    // Verificar que el rol existe
    const role = await interaction.guild!.roles.fetch(roleId);
    if (!role) {
      await interaction.reply({
        content: "❌ Rol no encontrado. Verifica el ID.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Agregar mapping
    session.mappings.push({
      roleId,
      type,
      emoji: type === "reaction" ? emojiOrLabel : undefined,
      buttonLabel: type === "button" ? emojiOrLabel : undefined,
      buttonStyle: type === "button" ? buttonStyle.toUpperCase() : undefined,
      order: session.mappings.length,
    });

    setupSessions.set(sessionId, session);

    await interaction.reply({
      content: `✅ Rol agregado: ${role.name}`,
      flags: [MessageFlags.Ephemeral],
    });

    // Actualizar el mensaje de configuración para reflejar el nuevo rol
    if (session.configMessageId) {
      try {
        const channel = await interaction.guild!.channels.fetch(session.uiChannelId);
        if (channel && channel.isTextBased()) {
          const configMessage = await (channel as any).messages.fetch(session.configMessageId);
          const updatedEmbed = await buildConfigEmbed(session, interaction.guild!);
          const components = buildConfigComponents(session);
          await configMessage.edit({
            embeds: [updatedEmbed],
            components,
          });
        }
      } catch (updateError) {
        logger.error("Error updating config message after adding role", {
          error: updateError instanceof Error ? updateError.message : String(updateError),
          sessionId,
        });
      }
    }
  } else if (interaction.customId.startsWith("autorole:modal:customize:")) {
    try {
      logger.info("Processing customize modal", {
        customId: interaction.customId,
        userId: interaction.user.id,
      });

      const sessionId = interaction.customId.replace(
        "autorole:modal:customize:",
        "",
      );

      logger.info("Session ID extracted", { sessionId });

      // Log todas las sesiones activas
      const allSessions = Array.from(setupSessions.keys());
      logger.info("Active sessions", {
        sessionId,
        allSessions,
        totalSessions: allSessions.length,
      });

      const session = setupSessions.get(sessionId);
      if (!session) {
        logger.warn("Session not found for customize modal", {
          sessionId,
          allSessions,
        });
        await interaction.reply({
          content: "❌ Sesión no encontrada.",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      logger.info("Session found, extracting field values");

      // Obtener valores del modal
      const embedColor = interaction.fields.getTextInputValue("embedColor");
      const embedFooter = interaction.fields.getTextInputValue("embedFooter");
      const embedThumb = interaction.fields.getTextInputValue("embedThumb");
      const embedImage = interaction.fields.getTextInputValue("embedImage");
      const embedAuthor = interaction.fields.getTextInputValue("embedAuthor");

      logger.info("Field values extracted", {
        embedColor,
        embedFooter,
        embedThumb,
        embedImage,
        embedAuthor,
      });

      // Validar color (debe ser hex)
      if (embedColor && !/^#?[0-9A-Fa-f]{6}$/.test(embedColor)) {
        logger.warn("Invalid color format", { embedColor });
        await interaction.reply({
          content: "❌ Color inválido. Usa formato hexadecimal (ej: #5865F2).",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      // Validar URLs (básico)
      const urlRegex = /^https?:\/\/.+/;
      if (embedThumb && !urlRegex.test(embedThumb)) {
        logger.warn("Invalid thumbnail URL", { embedThumb });
        await interaction.reply({
          content:
            "❌ URL de thumbnail inválida. Debe empezar con http:// o https://",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }
      if (embedImage && !urlRegex.test(embedImage)) {
        logger.warn("Invalid image URL", { embedImage });
        await interaction.reply({
          content:
            "❌ URL de imagen inválida. Debe empezar con http:// o https://",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      logger.info("Validations passed, updating session");

      // Actualizar sesión con personalizaciones
      session.embedColor = embedColor || undefined;
      session.embedFooter = embedFooter || undefined;
      session.embedThumb = embedThumb || undefined;
      session.embedImage = embedImage || undefined;
      session.embedAuthor = embedAuthor || undefined;

      setupSessions.set(sessionId, session);

      logger.info("Session updated with customizations", {
        sessionId,
        hasColor: !!session.embedColor,
        hasFooter: !!session.embedFooter,
        hasThumb: !!session.embedThumb,
        hasImage: !!session.embedImage,
        hasAuthor: !!session.embedAuthor,
      });

      await interaction.reply({
        content: "✅ Personalización del embed guardada.",
        flags: [MessageFlags.Ephemeral],
      });

      logger.info("Updating configuration interface");

      // Actualizar el mensaje de configuración existente
      if (session.configMessageId) {
        try {
          const channel = await interaction.guild!.channels.fetch(session.uiChannelId);
          if (channel && channel.isTextBased()) {
            const configMessage = await (channel as any).messages.fetch(
              session.configMessageId,
            );

            const updatedEmbed = await buildConfigEmbed(session, interaction.guild!);
            const components = buildConfigComponents(session);
            await configMessage.edit({
              embeds: [updatedEmbed],
              components,
            });

            logger.info("Configuration interface updated successfully");
          }
        } catch (updateError) {
          logger.error("Error updating configuration message", {
            error:
              updateError instanceof Error
                ? updateError.message
                : String(updateError),
            sessionId,
          });
        }
      }

      logger.info("Customize modal processed successfully");
    } catch (error) {
      logger.error("Error processing customize modal", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        customId: interaction.customId,
        userId: interaction.user.id,
      });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "❌ Error al procesar la personalización. Revisa la consola para más detalles.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  }
}

// Event listener para select menus
export async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
  if (interaction.customId === CUSTOM_IDS.autorole.select.REMOVE) {
    const sessionId = interaction.user.id;
    const session = setupSessions.get(sessionId);
    if (!session) return;

    const indexRaw = interaction.values[0];
    const index = Number.parseInt(indexRaw ?? "", 10);

    if (!Number.isFinite(index) || index < 0 || index >= session.mappings.length) {
      await interaction.reply({
        content: "❌ Selección inválida. Volvé a intentar.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    session.mappings.splice(index, 1);

    // Reordenar
    session.mappings.forEach((m, i) => (m.order = i));

    setupSessions.set(sessionId, session);

    // Mantener la UI de configuración consistente (igual que al agregar)
    if (session.configMessageId) {
      try {
        const channel = await interaction.guild!.channels.fetch(session.uiChannelId);
        if (channel && channel.isTextBased()) {
          const configMessage = await (channel as any).messages.fetch(
            session.configMessageId,
          );
          const updatedEmbed = await buildConfigEmbed(session, interaction.guild!);
          const components = buildConfigComponents(session);
          await configMessage.edit({
            embeds: [updatedEmbed],
            components,
          });
        }
      } catch (updateError) {
        logger.error("Error updating config message after removing role", {
          error:
            updateError instanceof Error ? updateError.message : String(updateError),
          sessionId,
        });
      }
    }

    await interaction.update({
      content: "✅ Rol eliminado.",
      components: [],
    });
  } else if (interaction.customId === CUSTOM_IDS.autorole.select.EDIT) {
    await interaction.reply({
      content:
        "⚠️ La edición de roles individuales se implementará en una futura actualización. Por ahora, elimina el rol y agrégalo de nuevo.",
      flags: [MessageFlags.Ephemeral],
    });
  }
}
