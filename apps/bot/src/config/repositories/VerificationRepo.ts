import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";
import type { IVerificationRequest } from "@charlybot/shared";

export async function createVerificationRequest(
  guildId: string,
  request: IVerificationRequest,
): Promise<void> {
  await prisma.verificationRequest.create({
    data: {
      id: request.id,
      guildId,
      discordUserId: request.discordUserId,
      status: "pending",
      requestedAt: request.requestedAt ? new Date(request.requestedAt) : undefined,
      reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : undefined,
      reviewedBy: request.reviewedBy,
      metadata: request.metadata,
    },
  });
  logger.info(`✅ Solicitud de verificación creada via API: ${request.id}`);
}

export async function getVerificationRequest(
  guildId: string,
  id: string,
): Promise<IVerificationRequest | null> {
  return await prisma.verificationRequest.findFirst({
    where: { id, guildId },
  });
}

export async function updateVerificationRequest(
  guildId: string,
  id: string,
  updates: Partial<IVerificationRequest>,
): Promise<void> {
  await prisma.verificationRequest.updateMany({
    where: { id, guildId },
    data: {
      ...updates,
      requestedAt: updates.requestedAt ? new Date(updates.requestedAt as string) : undefined,
      reviewedAt: updates.reviewedAt ? new Date(updates.reviewedAt as string) : undefined,
    },
  });
  logger.info(`✅ Solicitud de verificación actualizada via API: ${id}`);
}

export async function getPendingRequests(
  guildId: string,
): Promise<IVerificationRequest[]> {
  const pageSize = 50;
  return await prisma.verificationRequest.findMany({
    where: { guildId, status: "pending" },
    take: pageSize,
    orderBy: { requestedAt: "desc" },
  });
}

export async function deleteVerificationRequest(
  guildId: string,
  id: string,
): Promise<void> {
  await prisma.verificationRequest.deleteMany({
    where: { id, guildId },
  });
  logger.info(`🗑️ Solicitud de verificación eliminada via API: ${id}`);
}
