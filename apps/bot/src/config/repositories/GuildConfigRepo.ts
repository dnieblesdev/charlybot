import { HttpGuildConfigAdapter } from "../../infrastructure/api/HttpGuildConfigAdapter";
import logger from "../../utils/logger";
import type { IGuildConfig, Guild } from "@charlybot/shared";

// Instancia del adaptador (Port implementation)
const guildConfigRepo = new HttpGuildConfigAdapter();

/**
 * Obtiene la configuración de un servidor
 */
export async function getGuildConfig(guildId: string): Promise<IGuildConfig | null> {
  return guildConfigRepo.findById(guildId);
}

/**
 * Establece la configuración de un servidor
 */

export async function setImagenChannel(
  guildId: string,
  targetChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, targetChannelId });
  logger.info(
    `✅ Configuración guardada: Guild ${guildId} -> Canal ${targetChannelId}`,
  );
}

/**
 * Establece el canal de logs de voz para un servidor
 */
export async function setVoiceLogChannel(
  guildId: string,
  voiceLogChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, voiceLogChannelId });
  logger.info(
    `✅ Canal de logs de voz configurado: Guild ${guildId} -> Canal ${voiceLogChannelId}`,
  );
}

/**
 * Establece el canal de bienvenida
 */
export async function setWelcomeChannel(
  guildId: string,
  welcomeChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, welcomeChannelId });
  logger.info(
    `✅ Canal de bienvenida configurado: Guild ${guildId} -> Canal ${welcomeChannelId}`,
  );
}

/**
 * Establece el mensaje de bienvenida
 */
export async function setWelcomeMessage(
  guildId: string,
  welcomeMessage: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, welcomeMessage });
  logger.info(
    `✅ Mensaje de bienvenida configurado: Guild ${guildId} -> Message ${welcomeMessage}`,
  );
}

/**
 * Establece el canal de logs de salida (member leave)
 */
export async function setLeaveLogChannel(
  guildId: string,
  leaveLogChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, leaveLogChannelId });
  logger.info(
    `✅ Canal de logs de salida configurado: Guild ${guildId} -> Canal ${leaveLogChannelId}`,
  );
}

/**
 * Establece el canal de logs de mensajes (edición/eliminación)
 */
export async function setMessageLogChannel(
  guildId: string,
  messageLogChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, messageLogChannelId });
  logger.info(
    `✅ Canal de logs de mensajes configurado: Guild ${guildId} -> Canal ${messageLogChannelId}`,
  );
}

/**
 * Elimina la configuración de un servidor
 */
export async function removeGuildConfig(guildId: string): Promise<void> {
  await guildConfigRepo.delete(guildId);
  logger.info(`🗑️ Configuración eliminada: Guild ${guildId}`);
}

/**
 * Elimina el registro Guild y su configuración
 */
export async function deleteGuild(guildId: string): Promise<void> {
  await guildConfigRepo.deleteGuild(guildId);
  logger.info(`🗑️ Guild eliminado: ${guildId}`);
}

/**
 * Establece el canal donde está el embed de verificación
 */
export async function setVerificationChannel(
  guildId: string,
  verificationChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, verificationChannelId });
  logger.info(
    `✅ Canal de verificación configurado: Guild ${guildId} -> Canal ${verificationChannelId}`,
  );
}

/**
 * Establece el canal donde los moderadores revisan solicitudes
 */
export async function setVerificationReviewChannel(
  guildId: string,
  verificationReviewChannelId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, verificationReviewChannelId });

  logger.info(
    `✅ Canal de revisión de verificación configurado: Guild ${guildId} -> Canal ${verificationReviewChannelId}`,
  );
}

/**
 * Establece el rol que se asigna a usuarios verificados
 */
export async function setVerifiedRole(
  guildId: string,
  verifiedRoleId: string,
): Promise<void> {
  await guildConfigRepo.upsert(guildId, { guildId, verifiedRoleId });

  logger.info(
    `✅ Rol de verificado configurado: Guild ${guildId} -> Rol ${verifiedRoleId}`,
  );
}

/**
 * Obtiene todas las configuraciones
 */
export async function getAllGuildConfigs(): Promise<IGuildConfig[]> {
  return guildConfigRepo.findAll();
}

/**
 * Obtiene la metadata de un servidor
 */
export async function getGuild(guildId: string): Promise<Guild | null> {
  return guildConfigRepo.findGuildById(guildId);
}

/**
 * Actualiza o crea la metadata de un servidor
 */
export async function upsertGuild(
  guildId: string,
  data: Partial<Guild>,
): Promise<Guild> {
  return guildConfigRepo.upsertGuild(guildId, data);
}

