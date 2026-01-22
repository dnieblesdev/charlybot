import {
  SimpleStorage,
  prisma,
  PrismaStorage,
} from "../../infrastructure/storage/";
import logger from "../../utils/logger";

interface GuildConfig {
  id: string;
  guildId: string;
  targetChannelId?: string | null;
  voiceLogChannelId?: string | null;
  welcomeChannelId?: string | null;
  welcomeMessage?: string | null;
  leaveLogChannelId?: string | null;
  verificationChannelId?: string | null;
  verificationReviewChannelId?: string | null;
  verifiedRoleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ConfigData {
  guilds: Record<string, GuildConfig>;
}

// Instancia del storage para configuraciones
const storage = new PrismaStorage<GuildConfig>({
  prismaClient: prisma,
  modelName: "guildConfig",
  enableLogs: true,
  enableCache: true,
  cacheTTL: 300000,
});

/**
 * Obtiene la configuración de un servidor
 */
export async function getGuildConfig(guildId: string) {
  return storage.findById(guildId);
  //const config = await getConfigData();
  //return config.guilds[guildId] || null;
}

/**
 * Establece la configuración de un servidor
 */

export async function setImagenChannel(
  guildId: string,
  targetChannelId: string,
): Promise<void> {
  await storage.upsert(guildId, { guildId, targetChannelId });
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
  await storage.upsert(guildId, { guildId, voiceLogChannelId });
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
  await storage.upsert(guildId, { guildId, welcomeChannelId });
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
  await storage.upsert(guildId, { guildId, welcomeMessage });
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
  await storage.upsert(guildId, { guildId, leaveLogChannelId });
  logger.info(
    `✅ Canal de logs de salida configurado: Guild ${guildId} -> Canal ${leaveLogChannelId}`,
  );
}

/**
 * Elimina la configuración de un servidor
 */
export async function removeGuildConfig(guildId: string): Promise<void> {
  await storage.delete(guildId);
  logger.info(`🗑️ Configuración eliminada: Guild ${guildId}`);
}

/**
 * Establece el canal donde está el embed de verificación
 */
export async function setVerificationChannel(
  guildId: string,
  verificationChannelId: string,
): Promise<void> {
  await storage.upsert(guildId, { guildId, verificationChannelId });
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
  await storage.upsert(guildId, { guildId, verificationReviewChannelId });

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
  await storage.upsert(guildId, { guildId, verifiedRoleId });

  logger.info(
    `✅ Rol de verificado configurado: Guild ${guildId} -> Rol ${verifiedRoleId}`,
  );
}

/**
 * Obtiene todas las configuraciones
 */
export async function getAllGuildConfigs(): Promise<GuildConfig[]> {
  const data = await storage.findMany();
  return data as GuildConfig[];
}
