import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  GuildMember,
} from "discord.js";
import {
  createVerificationRequest,
  getVerificationRequest,
  updateVerificationRequest,
} from "../../config/repositories/VerificationRepo.ts";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import {
  getAllClasses,
  getClass,
} from "../../config/repositories/ClassRolesRepo.ts";
import { tempStorage } from "../../utils/temporaryStorage.ts";
import logger from "../../utils/logger.ts";

/**
 * Genera un ID único simple
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Maneja cuando un usuario hace clic en el botón "Verificarme"
 */
export async function handleVerificationStart(
  interaction: ButtonInteraction,
): Promise<void> {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este botón solo funciona en servidores.",
        ephemeral: true,
      });
      return;
    }

    // Verificar si el usuario ya está verificado
    const config = await getGuildConfig(interaction.guild.id);
    if (!config || !config.verifiedRoleId) {
      await interaction.reply({
        content:
          "❌ El sistema de verificación no está configurado correctamente.",
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    if (member.roles.cache.has(config.verifiedRoleId)) {
      await interaction.reply({
        content: "✅ Ya estás verificado en este servidor.",
        ephemeral: true,
      });
      return;
    }

    // Crear y mostrar el modal
    const modal = new ModalBuilder()
      .setCustomId(`verification_modal_${interaction.user.id}`)
      .setTitle("Verificación de Usuario");

    const inGameNameInput = new TextInputBuilder()
      .setCustomId("in_game_name")
      .setLabel("Tu nombre en el juego")
      .setPlaceholder("Ejemplo: Player123")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(
      inGameNameInput,
    );

    modal.addComponents(row1);

    await interaction.showModal(modal);

    logger.info("Modal de verificación mostrado", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });
  } catch (error) {
    logger.error("Error mostrando modal de verificación", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Hubo un error mostrando el formulario de verificación.",
        ephemeral: true,
      });
    }
  }
}

/**
 * Maneja cuando un usuario envía el modal de verificación
 */
export async function handleVerificationModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este formulario solo funciona en servidores.",
        ephemeral: true,
      });
      return;
    }

    const inGameName = interaction.fields
      .getTextInputValue("in_game_name")
      .trim();

    // Obtener clases configuradas
    const classes = await getAllClasses();

    if (classes.length === 0) {
      await interaction.reply({
        content:
          "❌ No hay clases configuradas en el sistema. Contacta a un administrador.",
        ephemeral: true,
      });
      return;
    }

    // Crear el select menu de clases
    const classSelect = new StringSelectMenuBuilder()
      .setCustomId(`class_select_${interaction.user.id}`)
      .setPlaceholder("Selecciona tu clase")
      .addOptions(
        classes.map((c) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(c.name)
            .setValue(c.name)
            .setDescription(`Tipo: ${c.type}`),
        ),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      classSelect,
    );

    // Guardar el nombre del juego en almacenamiento temporal
    tempStorage.set(interaction.user.id, inGameName);

    await interaction.reply({
      content: `**Paso 1/2:** Selecciona tu clase, ${inGameName}`,
      components: [row],
      ephemeral: true,
    });

    logger.info(
      "Modal de verificación procesado, esperando selección de clase",
      {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        inGameName,
      },
    );
  } catch (error) {
    logger.error("Error procesando solicitud de verificación", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Hubo un error procesando tu solicitud. Por favor, intenta de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Maneja cuando un usuario selecciona su clase
 */
export async function handleClassSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este menú solo funciona en servidores.",
        ephemeral: true,
      });
      return;
    }

    const selectedClass = interaction.values[0];
    if (!selectedClass) {
      await interaction.reply({
        content: "❌ No se seleccionó ninguna clase.",
        ephemeral: true,
      });
      return;
    }

    const classConfig = await getClass(selectedClass);

    if (!classConfig) {
      await interaction.reply({
        content: "❌ No se pudo encontrar la configuración de esta clase.",
        ephemeral: true,
      });
      return;
    }

    // Crear el select menu de subclases
    const subclassSelect = new StringSelectMenuBuilder()
      .setCustomId(`subclass_select_${interaction.user.id}_${selectedClass}`)
      .setPlaceholder("Selecciona tu subclase")
      .addOptions(
        classConfig.subclasses.map((sc) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(sc.name)
            .setValue(sc.name),
        ),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      subclassSelect,
    );

    await interaction.update({
      content: `**Paso 2/2:** Selecciona tu subclase de **${selectedClass}**`,
      components: [row],
    });

    logger.info("Clase seleccionada", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      selectedClass,
    });
  } catch (error) {
    logger.error("Error procesando selección de clase", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error procesando tu selección.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Maneja cuando un usuario selecciona su subclase (paso final)
 */
export async function handleSubclassSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  try {
    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Este menú solo funciona en servidores.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    // Extraer el nombre de la clase del customId
    const customIdParts = interaction.customId.split("_");
    const className = customIdParts.slice(3).join("_");
    const selectedSubclass = interaction.values[0];

    const classConfig = await getClass(className);
    if (!classConfig) {
      await interaction.editReply({
        content: "❌ No se pudo encontrar la configuración de esta clase.",
        components: [],
      });
      return;
    }

    const subclassConfig = classConfig.subclasses.find(
      (sc) => sc.name === selectedSubclass,
    );
    if (!subclassConfig) {
      await interaction.editReply({
        content: "❌ No se pudo encontrar la configuración de esta subclase.",
        components: [],
      });
      return;
    }

    // Obtener configuración del servidor
    const config = await getGuildConfig(interaction.guild.id);
    if (
      !config ||
      !config.verificationReviewChannelId ||
      !config.verifiedRoleId
    ) {
      await interaction.editReply({
        content:
          "❌ El sistema de verificación no está configurado correctamente.",
        components: [],
      });
      return;
    }

    const member = interaction.member as GuildMember;

    // Obtener el nombre del juego del almacenamiento temporal
    let inGameName = tempStorage.get(interaction.user.id);

    if (!inGameName) {
      // Fallback al username si no se encuentra en el almacenamiento
      inGameName = interaction.user.username;
      logger.warn(
        "No se encontró el nombre del juego en almacenamiento temporal",
        {
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        },
      );
    }

    // Limpiar el almacenamiento temporal
    tempStorage.delete(interaction.user.id);

    // Asignar todos los roles
    const rolesToAdd = [
      config.verifiedRoleId, // Rol verificado
      classConfig.roleId, // Rol de la clase
      classConfig.typeRoleId, // Rol del tipo (Healer/DPS/Tank)
      subclassConfig.roleId, // Rol de la subclase
    ];

    try {
      await member.roles.add(rolesToAdd);
    } catch (error) {
      logger.error("Error asignando roles", {
        error: error instanceof Error ? error.message : String(error),
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        roles: rolesToAdd,
      });
      await interaction.editReply({
        content:
          "❌ No pude asignar los roles. Verifica que el bot tenga permisos suficientes.",
        components: [],
      });
      return;
    }

    // Cambiar el nickname
    try {
      await member.setNickname(inGameName);
    } catch (error) {
      logger.warn("No se pudo cambiar el nickname", {
        error: error instanceof Error ? error.message : String(error),
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });
    }

    // Crear el log
    const requestId = generateId();
    const request = {
      id: requestId,
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      inGameName,
      screenshotUrl: `${className} - ${selectedSubclass}`,
      status: "approved" as const,
      requestedAt: Date.now(),
      reviewedAt: Date.now(),
    };

    await createVerificationRequest(request);

    // Enviar log al canal de moderadores
    const logChannel = (await interaction.guild.channels.fetch(
      config.verificationReviewChannelId,
    )) as TextChannel;

    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("✅ Usuario Verificado")
        .setDescription(
          `**Usuario:** ${interaction.user} (${interaction.user.tag})\n` +
            `**ID de Usuario:** ${interaction.user.id}\n` +
            `**Nombre en el juego:** ${inGameName}\n` +
            `**Clase:** ${className}\n` +
            `**Subclase:** ${selectedSubclass}\n` +
            `**Tipo:** ${classConfig.type}\n` +
            `**Verificado:** <t:${Math.floor(Date.now() / 1000)}:R>`,
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setColor(0x00ff00)
        .setFooter({ text: `ID: ${requestId}` })
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    }

    logger.info("Usuario verificado con clase y subclase", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      requestId,
      inGameName,
      className,
      selectedSubclass,
      type: classConfig.type,
    });

    await interaction.editReply({
      content:
        "✅ **¡Verificación completada!**\n\n" +
        `Has sido verificado exitosamente.\n` +
        `**Apodo:** ${inGameName}\n` +
        `**Clase:** ${className}\n` +
        `**Subclase:** ${selectedSubclass}\n` +
        `**Tipo:** ${classConfig.type}\n\n` +
        `Todos tus roles han sido asignados. ¡Bienvenido/a al servidor!`,
      components: [],
    });
  } catch (error) {
    logger.error("Error procesando selección de subclase", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Hubo un error completando tu verificación.";
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: errorMessage, components: [] });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Maneja cuando un moderador aprueba una solicitud (ya no se usa pero se mantiene por compatibilidad)
 */
export async function handleVerificationApprove(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.reply({
    content:
      "ℹ️ El sistema de verificación ahora es automático. Esta función ya no es necesaria.",
    ephemeral: true,
  });
}

/**
 * Maneja cuando un moderador rechaza una solicitud (ya no se usa pero se mantiene por compatibilidad)
 */
export async function handleVerificationReject(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.reply({
    content:
      "ℹ️ El sistema de verificación ahora es automático. Esta función ya no es necesaria.",
    ephemeral: true,
  });
}
