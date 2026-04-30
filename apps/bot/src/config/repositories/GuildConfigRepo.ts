import { prisma } from "@charlybot/shared";
import { getValkeyClient } from "../../infrastructure/valkey";
import logger from "../../utils/logger";
import type { IGuildConfig, Guild } from "@charlybot/shared";

// Cache constants (inlined from deleted cacheConstants)
const CACHE_TTL_CONFIG = 5 * 60 * 1000; // 5 minutes
const makeCacheKey = (guildId: string) => `guildConfig:${guildId}`;

/**
 * Obtiene la configuración de un servidor
 */
export async function getGuildConfig(guildId: string): Promise<IGuildConfig | null> {
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  // Check distributed cache first
  const cached = await valkey.get<IGuildConfig | null>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Fetch from Prisma
  const config = await prisma.guildConfig.findUnique({
    where: { guildId },
  });

  if (!config) {
    await valkey.set<null>(key, null, CACHE_TTL_CONFIG / 1000);
    return null;
  }

  const result: IGuildConfig = {
    guildId: config.guildId,
    name: config.name ?? undefined,
    targetChannelId: config.targetChannelId ?? undefined,
    voiceLogChannelId: config.voiceLogChannelId ?? undefined,
    welcomeChannelId: config.welcomeChannelId ?? undefined,
    welcomeMessage: config.welcomeMessage ?? undefined,
    leaveLogChannelId: config.leaveLogChannelId ?? undefined,
    verificationChannelId: config.verificationChannelId ?? undefined,
    verificationReviewChannelId: config.verificationReviewChannelId ?? undefined,
    verifiedRoleId: config.verifiedRoleId ?? undefined,
    messageLogChannelId: config.messageLogChannelId ?? undefined,
  };

  await valkey.set<IGuildConfig>(key, result, CACHE_TTL_CONFIG / 1000);
  return result;
}

/**
 * Establece la configuración de un servidor
 */
export async function setImagenChannel(
  guildId: string,
  targetChannelId: string,
): Promise<void> {
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  // Ensure Guild exists first
  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { targetChannelId },
    create: { guildId, targetChannelId },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { voiceLogChannelId },
    create: { guildId, voiceLogChannelId },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { welcomeChannelId },
    create: { guildId, welcomeChannelId },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { welcomeMessage },
    create: { guildId, welcomeMessage },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { leaveLogChannelId },
    create: { guildId, leaveLogChannelId },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { messageLogChannelId },
    create: { guildId, messageLogChannelId },
  });

  await valkey.del(key);
  logger.info(
    `✅ Canal de logs de mensajes configurado: Guild ${guildId} -> Canal ${messageLogChannelId}`,
  );
}

/**
 * Elimina la configuración de un servidor
 */
export async function removeGuildConfig(guildId: string): Promise<void> {
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guildConfig.deleteMany({ where: { guildId } });
  await valkey.del(key);
  logger.info(`🗑️ Configuración eliminada: Guild ${guildId}`);
}

/**
 * Elimina el registro Guild y su configuración
 */
export async function deleteGuild(guildId: string): Promise<void> {
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.$transaction(async (tx) => {
    await tx.guildConfig.deleteMany({ where: { guildId } });
    await tx.guild.deleteMany({ where: { guildId } });
  });

  await valkey.del(key);
  logger.info(`🗑️ Guild eliminado: ${guildId}`);
}

/**
 * Establece el canal donde está el embed de verificación
 */
export async function setVerificationChannel(
  guildId: string,
  verificationChannelId: string,
): Promise<void> {
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { verificationChannelId },
    create: { guildId, verificationChannelId },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { verificationReviewChannelId: verificationReviewChannelId },
    create: { guildId, verificationReviewChannelId: verificationReviewChannelId },
  });

  await valkey.del(key);
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
  const key = makeCacheKey(guildId);
  const valkey = getValkeyClient();

  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { verifiedRoleId },
    create: { guildId, verifiedRoleId },
  });

  await valkey.del(key);
  logger.info(
    `✅ Rol de verificado configurado: Guild ${guildId} -> Rol ${verifiedRoleId}`,
  );
}

/**
 * Obtiene todas las configuraciones
 */
export async function getAllGuildConfigs(): Promise<IGuildConfig[]> {
  const configs = await prisma.guildConfig.findMany();
  return configs.map((config): IGuildConfig => ({
    guildId: config.guildId,
    name: config.name ?? undefined,
    targetChannelId: config.targetChannelId ?? undefined,
    voiceLogChannelId: config.voiceLogChannelId ?? undefined,
    welcomeChannelId: config.welcomeChannelId ?? undefined,
    welcomeMessage: config.welcomeMessage ?? undefined,
    leaveLogChannelId: config.leaveLogChannelId ?? undefined,
    verificationChannelId: config.verificationChannelId ?? undefined,
    verificationReviewChannelId: config.verificationReviewChannelId ?? undefined,
    verifiedRoleId: config.verifiedRoleId ?? undefined,
    messageLogChannelId: config.messageLogChannelId ?? undefined,
  }));
}

/**
 * Obtiene la metadata de un servidor
 */
export async function getGuild(guildId: string): Promise<Guild | null> {
  const guild = await prisma.guild.findUnique({
    where: { guildId },
  });

  if (!guild) return null;

  return {
    guildId: guild.guildId,
    name: guild.name ?? null,
    prefix: guild.prefix ?? null,
    ownerId: guild.ownerId ?? null,
    ownerName: guild.ownerName ?? null,
    MemberCount: guild.MemberCount ?? null,
  } as unknown as Guild;
}

/**
 * Actualiza o crea la metadata de un servidor
 */
export async function upsertGuild(
  guildId: string,
  data: Partial<Guild>,
): Promise<Guild> {
  // Map camelCase Discord fields to PascalCase Prisma fields
  const prismaData: Record<string, unknown> = {};
  if (data.name !== undefined) prismaData.name = data.name;
  if (data.prefix !== undefined) prismaData.prefix = data.prefix;
  if (data.ownerId !== undefined) prismaData.ownerId = data.ownerId;
  if (data.ownerName !== undefined) prismaData.ownerName = data.ownerName;
  if (data.MemberCount !== undefined) prismaData.MemberCount = data.MemberCount;

  const guild = await prisma.guild.upsert({
    where: { guildId },
    update: prismaData,
    create: { guildId, ...prismaData },
  });

  return {
    guildId: guild.guildId,
    name: guild.name ?? null,
    prefix: guild.prefix ?? null,
    ownerId: guild.ownerId ?? null,
    ownerName: guild.ownerName ?? null,
    MemberCount: guild.MemberCount ?? null,
  } as unknown as Guild;
}