import { HttpAutoRoleAdapter } from "../../infrastructure/api/HttpAutoRoleAdapter";
import logger from "../../utils/logger";
import type { AutoRole, RoleMapping, IAutoRole, IRoleMapping } from "@charlybot/shared";
import type { AutoRoleWithMappings } from "../../domain/ports/IAutoRoleRepository";

// Instancia del adaptador (Port implementation)
const autoRoleRepo = new HttpAutoRoleAdapter();

/**
 * Crea una nueva configuración de auto-role
 */
export async function createAutoRole(
  guildId: string,
  data: IAutoRole,
): Promise<AutoRoleWithMappings> {
  try {
    const autoRole = await autoRoleRepo.create(guildId, data);

    logger.info("AutoRole created via API", {
      guildId: autoRole.guildId,
      messageId: autoRole.messageId,
    });

    return autoRole;
  } catch (error) {
    logger.error("Error creating AutoRole via API", {
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
  guildId: string,
  messageId: string,
): Promise<AutoRoleWithMappings | null> {
  try {
    return await autoRoleRepo.findByMessageId(guildId, messageId);
  } catch (error) {
    logger.error("Error getting AutoRole by messageId via API", {
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
): Promise<AutoRoleWithMappings[]> {
  try {
    return await autoRoleRepo.findByGuildId(guildId);
  } catch (error) {
    logger.error("Error getting AutoRoles by guildId via API", {
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
  guildId: string,
  id: number,
  data: Partial<Omit<IAutoRole, "mappings">>,
): Promise<AutoRoleWithMappings> {
  try {
    const autoRole = await autoRoleRepo.update(guildId, id, data);

    logger.info("AutoRole updated via API", {
      id,
    });

    return autoRole;
  } catch (error) {
    logger.error("Error updating AutoRole via API", {
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
export async function deleteAutoRole(
  guildId: string,
  id: number,
): Promise<void> {
  try {
    await autoRoleRepo.delete(guildId, id);
    logger.info("AutoRole deleted via API", { id });
  } catch (error) {
    logger.error("Error deleting AutoRole via API", {
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
  guildId: string,
  messageId: string,
): Promise<void> {
  try {
    await autoRoleRepo.deleteByMessageId(guildId, messageId);
    logger.info("AutoRole deleted by messageId via API", { messageId });
  } catch (error) {
    logger.error("Error deleting AutoRole by messageId via API", {
      error: error instanceof Error ? error.message : String(error),
      messageId,
    });
    throw error;
  }
}

/**
 * Agrega un mapping de rol
 */
export async function addRoleMapping(
  guildId: string,
  autoRoleId: number,
  data: IRoleMapping,
): Promise<RoleMapping> {
  try {
    const mapping = await autoRoleRepo.addMapping(guildId, autoRoleId, data);
    return mapping;
  } catch (error) {
    logger.error("Error creating RoleMapping via API", {
      error: error instanceof Error ? error.message : String(error),
      autoRoleId,
      data,
    });
    throw error;
  }
}

/**
 * Elimina un mapping de rol
 */
export async function removeRoleMapping(
  guildId: string,
  id: number,
): Promise<void> {
  try {
    await autoRoleRepo.removeMapping(guildId, id);
  } catch (error) {
    logger.error("Error deleting RoleMapping via API", {
      error: error instanceof Error ? error.message : String(error),
      id,
    });
    throw error;
  }
}

/**
 * Actualiza un mapping de rol
 */
export async function updateRoleMapping(
  guildId: string,
  id: number,
  data: Partial<IRoleMapping>,
): Promise<RoleMapping> {
  try {
    return await autoRoleRepo.updateMapping(guildId, id, data);
  } catch (error) {
    logger.error("Error updating RoleMapping via API", {
      error: error instanceof Error ? error.message : String(error),
      id,
      data,
    });
    throw error;
  }
}

/**
 * Elimina todos los mappings de una configuración
 */
export async function removeAllRoleMappings(
  guildId: string,
  autoRoleId: number,
): Promise<void> {
  try {
    await autoRoleRepo.removeAllMappings(guildId, autoRoleId);
  } catch (error) {
    logger.error("Error removing all RoleMappings via API", {
      error: error instanceof Error ? error.message : String(error),
      autoRoleId,
    });
    throw error;
  }
}
