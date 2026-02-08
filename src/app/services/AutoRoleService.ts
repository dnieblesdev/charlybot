import {
  Guild,
  GuildMember,
  Role,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  TextChannel,
} from "discord.js";
import logger from "../../utils/logger.js";
import * as AutoRoleRepo from "../../config/repositories/AutoRoleRepo.js";
import type { AutoRole, RoleMapping } from "../../generated/prisma/client.js";

/**
 * Valida que el bot pueda asignar un rol (jerarquía)
 */
export async function validateRoleHierarchy(
  guild: Guild,
  roleId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const role = await guild.roles.fetch(roleId);
    if (!role) {
      return { valid: false, error: "El rol no existe en el servidor." };
    }

    const botMember = await guild.members.fetchMe();
    const botHighestRole = botMember.roles.highest;

    if (role.position >= botHighestRole.position) {
      return {
        valid: false,
        error: `No puedo asignar el rol ${role.name} porque está por encima o al mismo nivel que mi rol más alto.`,
      };
    }

    if (!botMember.permissions.has("ManageRoles")) {
      return {
        valid: false,
        error: "No tengo permisos para gestionar roles.",
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error("Error validating role hierarchy", {
      error: error instanceof Error ? error.message : String(error),
      roleId,
      guildId: guild.id,
    });
    return {
      valid: false,
      error: "Error al validar la jerarquía de roles.",
    };
  }
}

/**
 * Valida una configuración completa antes de guardar
 */
export async function validateConfiguration(
  guild: Guild,
  mappings: Array<{
    roleId: string;
    type: string;
    emoji?: string;
    buttonLabel?: string;
  }>,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (mappings.length === 0) {
    errors.push("Debes agregar al menos un rol.");
  }

  if (mappings.length > 10) {
    errors.push("No puedes agregar más de 10 roles.");
  }

  // Validar cada mapping
  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i];
    if (!mapping) continue;

    // Validar que el rol existe y se puede asignar
    const validation = await validateRoleHierarchy(guild, mapping.roleId);
    if (!validation.valid) {
      errors.push(`Rol ${i + 1}: ${validation.error}`);
    }

    // Validar tipo
    if (mapping.type !== "reaction" && mapping.type !== "button") {
      errors.push(
        `Rol ${i + 1}: Tipo inválido (debe ser 'reaction' o 'button').`,
      );
    }

    // Validar que tenga emoji o buttonLabel según el tipo
    if (mapping.type === "reaction" && !mapping.emoji) {
      errors.push(`Rol ${i + 1}: Las reacciones requieren un emoji.`);
    }

    if (mapping.type === "button" && !mapping.buttonLabel) {
      errors.push(`Rol ${i + 1}: Los botones requieren una etiqueta.`);
    }
  }

  // Validar emojis duplicados
  const emojis = mappings
    .filter((m) => m.type === "reaction" && m.emoji)
    .map((m) => m.emoji);
  const duplicateEmojis = emojis.filter(
    (emoji, index) => emojis.indexOf(emoji) !== index,
  );
  if (duplicateEmojis.length > 0) {
    errors.push(`Emojis duplicados: ${duplicateEmojis.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Asigna un rol a un usuario
 */
export async function assignRole(
  member: GuildMember,
  roleId: string,
  autoRole: AutoRole & { mappings: RoleMapping[] },
): Promise<{ success: boolean; error?: string }> {
  try {
    const role = await member.guild.roles.fetch(roleId);
    if (!role) {
      return { success: false, error: "El rol no existe." };
    }

    // Si el modo es "unique", quitar otros roles del mismo autoRole
    if (autoRole.mode === "unique") {
      const otherRoles = autoRole.mappings
        .filter((m: RoleMapping) => m.roleId !== roleId)
        .map((m: RoleMapping) => m.roleId);

      for (const otherRoleId of otherRoles) {
        if (member.roles.cache.has(otherRoleId)) {
          await member.roles.remove(otherRoleId);
          logger.info("Role removed (unique mode)", {
            userId: member.id,
            roleId: otherRoleId,
            guildId: member.guild.id,
          });
        }
      }
    }

    // Asignar el rol
    await member.roles.add(role);

    logger.info("Role assigned via AutoRole", {
      userId: member.id,
      username: member.user.username,
      roleId: role.id,
      roleName: role.name,
      guildId: member.guild.id,
      autoRoleId: autoRole.id,
      messageId: autoRole.messageId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error assigning role", {
      error: error instanceof Error ? error.message : String(error),
      userId: member.id,
      roleId,
    });
    return {
      success: false,
      error: "Error al asignar el rol.",
    };
  }
}

/**
 * Quita un rol a un usuario
 */
export async function removeRole(
  member: GuildMember,
  roleId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const role = await member.guild.roles.fetch(roleId);
    if (!role) {
      return { success: false, error: "El rol no existe." };
    }

    if (!member.roles.cache.has(roleId)) {
      return { success: true }; // Ya no tiene el rol
    }

    await member.roles.remove(role);

    logger.info("Role removed via AutoRole", {
      userId: member.id,
      username: member.user.username,
      roleId: role.id,
      roleName: role.name,
      guildId: member.guild.id,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error removing role", {
      error: error instanceof Error ? error.message : String(error),
      userId: member.id,
      roleId,
    });
    return {
      success: false,
      error: "Error al quitar el rol.",
    };
  }
}

/**
 * Crea un mensaje con embed y botones/reacciones
 */
export async function createMessageWithRoles(
  channel: TextChannel,
  data: {
    embedTitle: string;
    embedDesc: string;
    embedColor?: string;
    embedFooter?: string;
    embedThumb?: string;
    embedImage?: string;
    embedTimestamp?: boolean;
    embedAuthor?: string;
    mappings: Array<{
      roleId: string;
      type: string;
      emoji?: string;
      buttonLabel?: string;
      buttonStyle?: string;
    }>;
  },
): Promise<{ success: boolean; message?: Message; error?: string }> {
  try {
    const guild = channel.guild;

    // Crear el embed
    const embed = new EmbedBuilder()
      .setTitle(data.embedTitle)
      .setDescription(data.embedDesc);

    // Aplicar personalizaciones
    if (data.embedColor) {
      const colorInt = parseInt(data.embedColor.replace("#", ""), 16);
      embed.setColor(colorInt);
    } else {
      embed.setColor(0x5865f2);
    }

    if (data.embedFooter) {
      embed.setFooter({ text: data.embedFooter });
    }

    if (data.embedThumb) {
      embed.setThumbnail(data.embedThumb);
    }

    if (data.embedImage) {
      embed.setImage(data.embedImage);
    }

    if (data.embedTimestamp) {
      embed.setTimestamp();
    }

    if (data.embedAuthor) {
      embed.setAuthor({ name: data.embedAuthor });
    }

    // Crear componentes (botones)
    const buttons = data.mappings
      .filter((m) => m.type === "button")
      .map((mapping, index) => {
        const styleMap: Record<string, ButtonStyle> = {
          PRIMARY: ButtonStyle.Primary,
          SECONDARY: ButtonStyle.Secondary,
          SUCCESS: ButtonStyle.Success,
          DANGER: ButtonStyle.Danger,
        };

        const style =
          styleMap[mapping.buttonStyle || "PRIMARY"] || ButtonStyle.Primary;

        return new ButtonBuilder()
          .setCustomId(`autorole_${mapping.roleId}`)
          .setLabel(mapping.buttonLabel || `Rol ${index + 1}`)
          .setStyle(style);
      });

    // Crear action rows (máximo 5 botones por row)
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttons.slice(i, i + 5),
      );
      actionRows.push(row);
    }

    // Enviar el mensaje
    const message = await channel.send({
      embeds: [embed],
      components: actionRows,
    });

    // Agregar reacciones
    const reactions = data.mappings.filter((m) => m.type === "reaction");
    for (const mapping of reactions) {
      if (mapping.emoji) {
        try {
          await message.react(mapping.emoji);
        } catch (error) {
          logger.error("Error adding reaction", {
            error: error instanceof Error ? error.message : String(error),
            emoji: mapping.emoji,
            messageId: message.id,
          });
        }
      }
    }

    logger.info("AutoRole message created", {
      messageId: message.id,
      channelId: channel.id,
      guildId: guild.id,
    });

    return { success: true, message };
  } catch (error) {
    logger.error("Error creating message with roles", {
      error: error instanceof Error ? error.message : String(error),
      channelId: channel.id,
    });
    return {
      success: false,
      error: "Error al crear el mensaje.",
    };
  }
}

/**
 * Actualiza un mensaje existente con nuevos botones
 */
export async function updateMessageWithRoles(
  message: Message,
  data: {
    embedTitle?: string;
    embedDesc?: string;
    embedColor?: string;
    embedFooter?: string;
    embedThumb?: string;
    embedImage?: string;
    embedTimestamp?: boolean;
    embedAuthor?: string;
    mappings: Array<{
      roleId: string;
      type: string;
      emoji?: string;
      buttonLabel?: string;
      buttonStyle?: string;
    }>;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const guild = message.guild;
    if (!guild) {
      return {
        success: false,
        error: "El mensaje no pertenece a un servidor.",
      };
    }

    // Obtener el embed actual o crear uno nuevo
    const currentEmbed = message.embeds[0];
    const embed = currentEmbed
      ? EmbedBuilder.from(currentEmbed)
      : new EmbedBuilder().setColor(0x5865f2);

    // Actualizar título y descripción si se proporcionan
    if (data.embedTitle) {
      embed.setTitle(data.embedTitle);
    }
    if (data.embedDesc) {
      embed.setDescription(data.embedDesc);
    }

    // Aplicar personalizaciones
    if (data.embedColor) {
      const colorInt = parseInt(data.embedColor.replace("#", ""), 16);
      embed.setColor(colorInt);
    }

    if (data.embedFooter) {
      embed.setFooter({ text: data.embedFooter });
    }

    if (data.embedThumb) {
      embed.setThumbnail(data.embedThumb);
    }

    if (data.embedImage) {
      embed.setImage(data.embedImage);
    }

    if (data.embedTimestamp) {
      embed.setTimestamp();
    }

    if (data.embedAuthor) {
      embed.setAuthor({ name: data.embedAuthor });
    }

    // Crear componentes (botones)
    const buttons = data.mappings
      .filter((m) => m.type === "button")
      .map((mapping, index) => {
        const styleMap: Record<string, ButtonStyle> = {
          PRIMARY: ButtonStyle.Primary,
          SECONDARY: ButtonStyle.Secondary,
          SUCCESS: ButtonStyle.Success,
          DANGER: ButtonStyle.Danger,
        };

        const style =
          styleMap[mapping.buttonStyle || "PRIMARY"] || ButtonStyle.Primary;

        return new ButtonBuilder()
          .setCustomId(`autorole_${mapping.roleId}`)
          .setLabel(mapping.buttonLabel || `Rol ${index + 1}`)
          .setStyle(style);
      });

    // Crear action rows
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttons.slice(i, i + 5),
      );
      actionRows.push(row);
    }

    // Actualizar el mensaje
    await message.edit({
      embeds: [embed],
      components: actionRows,
    });

    // Limpiar reacciones anteriores
    await message.reactions.removeAll();

    // Agregar nuevas reacciones
    const reactions = data.mappings.filter((m) => m.type === "reaction");
    for (const mapping of reactions) {
      if (mapping.emoji) {
        try {
          await message.react(mapping.emoji);
        } catch (error) {
          logger.error("Error adding reaction", {
            error: error instanceof Error ? error.message : String(error),
            emoji: mapping.emoji,
            messageId: message.id,
          });
        }
      }
    }

    logger.info("AutoRole message updated", {
      messageId: message.id,
      channelId: message.channelId,
      guildId: guild.id,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error updating message with roles", {
      error: error instanceof Error ? error.message : String(error),
      messageId: message.id,
    });
    return {
      success: false,
      error: "Error al actualizar el mensaje.",
    };
  }
}
