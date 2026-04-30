import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";
import type { AutoRole, RoleMapping, IAutoRole, IRoleMapping } from "@charlybot/shared";
import type { AutoRoleWithMappings } from "../../domain/ports/IAutoRoleRepository";

/**
 * Crea una nueva configuración de auto-role
 */
export async function createAutoRole(
  guildId: string,
  data: IAutoRole,
): Promise<AutoRoleWithMappings> {
  try {
    const autoRole = await prisma.autoRole.create({
      data: {
        guildId,
        channelId: data.channelId,
        messageId: data.messageId,
        mode: data.mode,
        embedTitle: data.embedTitle ?? null,
        embedDesc: data.embedDesc ?? null,
        embedColor: data.embedColor ?? null,
        embedFooter: data.embedFooter ?? null,
        embedThumb: data.embedThumb ?? null,
        embedImage: data.embedImage ?? null,
        embedTimestamp: data.embedTimestamp ?? null,
        embedAuthor: data.embedAuthor ?? null,
        createdBy: data.createdBy,
        mappings: {
          create: data.mappings.map((m) => ({
            roleId: m.roleId,
            type: m.type,
            emoji: m.emoji ?? null,
            buttonLabel: m.buttonLabel ?? null,
            buttonStyle: m.buttonStyle ?? null,
            order: m.order,
          })),
        },
      },
      include: { mappings: true },
    });

    logger.info("AutoRole created via Prisma", {
      guildId: autoRole.guildId,
      messageId: autoRole.messageId,
    });

    return autoRole as AutoRoleWithMappings;
  } catch (error) {
    logger.error("Error creating AutoRole via Prisma", {
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
    const autoRole = await prisma.autoRole.findUnique({
      where: { guildId_messageId: { guildId, messageId } },
      include: { mappings: true },
    });

    return autoRole as AutoRoleWithMappings | null;
  } catch (error) {
    logger.error("Error getting AutoRole by messageId via Prisma", {
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
    const autoroles = await prisma.autoRole.findMany({
      where: { guildId },
      include: { mappings: true },
    });

    return autoroles as AutoRoleWithMappings[];
  } catch (error) {
    logger.error("Error getting AutoRoles by guildId via Prisma", {
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
    // Verify ownership
    const existing = await prisma.autoRole.findUnique({
      where: { id },
    });
    if (!existing || existing.guildId !== guildId) {
      throw new Error("AutoRole not found in this guild");
    }

    // `updateMany` doesn't support `include` and returns BatchPayload.
    // We already validated ownership, so `update` on the unique `id` is safe here.
    const autoRole = await prisma.autoRole.update({
      where: { id },
      data: {
        channelId: data.channelId,
        messageId: data.messageId,
        mode: data.mode,
        embedTitle: data.embedTitle ?? null,
        embedDesc: data.embedDesc ?? null,
        embedColor: data.embedColor ?? null,
        embedFooter: data.embedFooter ?? null,
        embedThumb: data.embedThumb ?? null,
        embedImage: data.embedImage ?? null,
        embedTimestamp: data.embedTimestamp ?? null,
        embedAuthor: data.embedAuthor ?? null,
        createdBy: data.createdBy,
      },
      include: { mappings: true },
    });

    logger.info("AutoRole updated via Prisma", { id });

    return autoRole as AutoRoleWithMappings;
  } catch (error) {
    logger.error("Error updating AutoRole via Prisma", {
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
    await prisma.autoRole.deleteMany({
      where: { id, guildId },
    });
    logger.info("AutoRole deleted via Prisma", { id });
  } catch (error) {
    logger.error("Error deleting AutoRole via Prisma", {
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
    await prisma.autoRole.delete({
      where: { guildId_messageId: { guildId, messageId } },
    });
    logger.info("AutoRole deleted by messageId via Prisma", { messageId });
  } catch (error) {
    logger.error("Error deleting AutoRole by messageId via Prisma", {
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
    const autoRole = await prisma.autoRole.findUnique({
      where: { id: autoRoleId },
    });
    if (!autoRole || autoRole.guildId !== guildId) {
      throw new Error("AutoRole not found in this guild");
    }

    const mapping = await prisma.roleMapping.create({
      data: {
        autoRoleId,
        roleId: data.roleId,
        type: data.type,
        emoji: data.emoji ?? null,
        buttonLabel: data.buttonLabel ?? null,
        buttonStyle: data.buttonStyle ?? null,
        order: data.order,
      },
    });
    return mapping as RoleMapping;
  } catch (error) {
    logger.error("Error creating RoleMapping via Prisma", {
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
    // Verify the autoRole belongs to this guild
    const mapping = await prisma.roleMapping.findUnique({
      where: { id },
      include: { autoRole: true },
    });
    if (!mapping || mapping.autoRole.guildId !== guildId) {
      throw new Error("RoleMapping not found in this guild");
    }

    await prisma.roleMapping.delete({
      where: { id },
    });
  } catch (error) {
    logger.error("Error deleting RoleMapping via Prisma", {
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
    // Verify the autoRole belongs to this guild
    const existing = await prisma.roleMapping.findUnique({
      where: { id },
      include: { autoRole: true },
    });
    if (!existing || existing.autoRole.guildId !== guildId) {
      throw new Error("RoleMapping not found in this guild");
    }

    const mapping = await prisma.roleMapping.update({
      where: { id },
      data: {
        roleId: data.roleId,
        type: data.type,
        emoji: data.emoji ?? null,
        buttonLabel: data.buttonLabel ?? null,
        buttonStyle: data.buttonStyle ?? null,
        order: data.order,
      },
    });
    return mapping as RoleMapping;
  } catch (error) {
    logger.error("Error updating RoleMapping via Prisma", {
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
    // Verify the autoRole belongs to this guild
    const autoRole = await prisma.autoRole.findUnique({
      where: { id: autoRoleId },
    });
    if (!autoRole || autoRole.guildId !== guildId) {
      throw new Error("AutoRole not found in this guild");
    }

    await prisma.roleMapping.deleteMany({
      where: { autoRoleId },
    });
  } catch (error) {
    logger.error("Error removing all RoleMappings via Prisma", {
      error: error instanceof Error ? error.message : String(error),
      autoRoleId,
    });
    throw error;
  }
}
