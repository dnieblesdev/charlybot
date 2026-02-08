import { prisma } from "../../infrastructure/storage/prismaClient.js";
import logger from "../../utils/logger.js";
import type { AutoRole, RoleMapping } from "../../generated/prisma/client.js";

/**
 * Crea una nueva configuración de auto-role
 */
export async function createAutoRole(data: {
  guildId: string;
  channelId: string;
  messageId: string;
  mode: string;
  embedTitle?: string;
  embedDesc?: string;
  embedColor?: string;
  embedFooter?: string;
  embedThumb?: string;
  embedImage?: string;
  embedTimestamp?: boolean;
  embedAuthor?: string;
  createdBy: string;
}): Promise<AutoRole> {
  try {
    const autoRole = await prisma.autoRole.create({
      data,
      include: {
        mappings: true,
      },
    });

    logger.info("AutoRole created", {
      autoRoleId: autoRole.id,
      guildId: autoRole.guildId,
      messageId: autoRole.messageId,
      mode: autoRole.mode,
    });

    return autoRole;
  } catch (error) {
    logger.error("Error creating AutoRole", {
      error: error instanceof Error ? error.message : String(error),
      data,
    });
    throw error;
  }
}

/**
 * Obtiene una configuración de auto-role por ID de mensaje
 */
export async function getAutoRoleByMessageId(
  messageId: string,
): Promise<(AutoRole & { mappings: RoleMapping[] }) | null> {
  try {
    const autoRole = await prisma.autoRole.findFirst({
      where: { messageId },
      include: {
        mappings: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return autoRole;
  } catch (error) {
    logger.error("Error getting AutoRole by messageId", {
      error: error instanceof Error ? error.message : String(error),
      messageId,
    });
    throw error;
  }
}

/**
 * Obtiene todas las configuraciones de auto-role de un servidor
 */
export async function getAutoRolesByGuild(
  guildId: string,
): Promise<(AutoRole & { mappings: RoleMapping[] })[]> {
  try {
    const autoRoles = await prisma.autoRole.findMany({
      where: { guildId },
      include: {
        mappings: {
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return autoRoles;
  } catch (error) {
    logger.error("Error getting AutoRoles by guildId", {
      error: error instanceof Error ? error.message : String(error),
      guildId,
    });
    throw error;
  }
}

/**
 * Actualiza una configuración de auto-role
 */
export async function updateAutoRole(
  id: number,
  data: {
    mode?: string;
    embedTitle?: string;
    embedDesc?: string;
    embedColor?: string;
    embedFooter?: string;
    embedThumb?: string;
    embedImage?: string;
    embedTimestamp?: boolean;
    embedAuthor?: string;
  },
): Promise<AutoRole> {
  try {
    const autoRole = await prisma.autoRole.update({
      where: { id },
      data,
      include: {
        mappings: true,
      },
    });

    logger.info("AutoRole updated", {
      autoRoleId: autoRole.id,
      guildId: autoRole.guildId,
      messageId: autoRole.messageId,
    });

    return autoRole;
  } catch (error) {
    logger.error("Error updating AutoRole", {
      error: error instanceof Error ? error.message : String(error),
      id,
      data,
    });
    throw error;
  }
}

/**
 * Elimina una configuración de auto-role
 */
export async function deleteAutoRole(id: number): Promise<void> {
  try {
    await prisma.autoRole.delete({
      where: { id },
    });

    logger.info("AutoRole deleted", {
      autoRoleId: id,
    });
  } catch (error) {
    logger.error("Error deleting AutoRole", {
      error: error instanceof Error ? error.message : String(error),
      id,
    });
    throw error;
  }
}

/**
 * Elimina una configuración de auto-role por messageId
 */
export async function deleteAutoRoleByMessageId(
  messageId: string,
): Promise<void> {
  try {
    await prisma.autoRole.deleteMany({
      where: { messageId },
    });

    logger.info("AutoRole deleted by messageId", {
      messageId,
    });
  } catch (error) {
    logger.error("Error deleting AutoRole by messageId", {
      error: error instanceof Error ? error.message : String(error),
      messageId,
    });
    throw error;
  }
}

/**
 * Agrega un mapping de rol
 */
export async function addRoleMapping(data: {
  autoRoleId: number;
  roleId: string;
  type: string;
  emoji?: string;
  buttonLabel?: string;
  buttonStyle?: string;
  order: number;
}): Promise<RoleMapping> {
  try {
    const mapping = await prisma.roleMapping.create({
      data,
    });

    logger.info("RoleMapping created", {
      mappingId: mapping.id,
      autoRoleId: mapping.autoRoleId,
      roleId: mapping.roleId,
      type: mapping.type,
    });

    return mapping;
  } catch (error) {
    logger.error("Error creating RoleMapping", {
      error: error instanceof Error ? error.message : String(error),
      data,
    });
    throw error;
  }
}

/**
 * Elimina un mapping de rol
 */
export async function removeRoleMapping(id: number): Promise<void> {
  try {
    await prisma.roleMapping.delete({
      where: { id },
    });

    logger.info("RoleMapping deleted", {
      mappingId: id,
    });
  } catch (error) {
    logger.error("Error deleting RoleMapping", {
      error: error instanceof Error ? error.message : String(error),
      id,
    });
    throw error;
  }
}

/**
 * Elimina todos los mappings de un auto-role
 */
export async function removeAllRoleMappings(autoRoleId: number): Promise<void> {
  try {
    await prisma.roleMapping.deleteMany({
      where: { autoRoleId },
    });

    logger.info("All RoleMappings deleted for AutoRole", {
      autoRoleId,
    });
  } catch (error) {
    logger.error("Error deleting all RoleMappings", {
      error: error instanceof Error ? error.message : String(error),
      autoRoleId,
    });
    throw error;
  }
}

/**
 * Obtiene los mappings de un auto-role
 */
export async function getRoleMappings(
  autoRoleId: number,
): Promise<RoleMapping[]> {
  try {
    const mappings = await prisma.roleMapping.findMany({
      where: { autoRoleId },
      orderBy: {
        order: "asc",
      },
    });

    return mappings;
  } catch (error) {
    logger.error("Error getting RoleMappings", {
      error: error instanceof Error ? error.message : String(error),
      autoRoleId,
    });
    throw error;
  }
}

/**
 * Actualiza un mapping de rol
 */
export async function updateRoleMapping(
  id: number,
  data: {
    roleId?: string;
    emoji?: string;
    buttonLabel?: string;
    buttonStyle?: string;
    order?: number;
  },
): Promise<RoleMapping> {
  try {
    const mapping = await prisma.roleMapping.update({
      where: { id },
      data,
    });

    logger.info("RoleMapping updated", {
      mappingId: mapping.id,
      autoRoleId: mapping.autoRoleId,
    });

    return mapping;
  } catch (error) {
    logger.error("Error updating RoleMapping", {
      error: error instanceof Error ? error.message : String(error),
      id,
      data,
    });
    throw error;
  }
}
