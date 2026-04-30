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
      userId: request.userId,
      status: "pending" as const,
      requestedAt: request.requestedAt ? new Date(request.requestedAt) : undefined,
      reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : undefined,
      reviewedBy: request.reviewedBy,
      inGameName: "", // Required field not in IVerificationRequest
      screenshotUrl: "", // Required field not in IVerificationRequest
    },
  });
  logger.info(`✅ Solicitud de verificación creada via API: ${request.id}`);
}

export async function getVerificationRequest(
  guildId: string,
  id: string,
): Promise<IVerificationRequest | null> {
  const result = await prisma.verificationRequest.findFirst({
    where: { id, guildId },
  });
  if (!result) return null;
  return {
    ...result,
    discordUserId: result.userId,
  } as unknown as IVerificationRequest;
}

export async function updateVerificationRequest(
  guildId: string,
  id: string,
  updates: Partial<IVerificationRequest>,
): Promise<void> {
  await prisma.verificationRequest.updateMany({
    where: { id, guildId },
    data: {
      status: updates.status as "pending" | "approved" | "rejected" | undefined,
      requestedAt: updates.requestedAt ? new Date(updates.requestedAt as string) : undefined,
      reviewedAt: updates.reviewedAt ? new Date(updates.reviewedAt as string) : undefined,
      reviewedBy: updates.reviewedBy,
    },
  });
  logger.info(`✅ Solicitud de verificación actualizada via API: ${id}`);
}

export async function getPendingRequests(
  guildId: string,
): Promise<IVerificationRequest[]> {
  const pageSize = 50;
  const results = await prisma.verificationRequest.findMany({
    where: { guildId, status: "pending" },
    take: pageSize,
    orderBy: { requestedAt: "desc" },
  });
  return results.map((r) => ({
    ...r,
    discordUserId: r.userId,
  } as unknown as IVerificationRequest));
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
