import { HttpVerificationAdapter } from "../../infrastructure/api/HttpVerificationAdapter";
import logger from "../../utils/logger";
import type { IVerificationRequest } from "@charlybot/shared";

// Instancia del adaptador (Port implementation)
const verificationRepo = new HttpVerificationAdapter();

export async function createVerificationRequest(
  guildId: string,
  request: IVerificationRequest,
): Promise<void> {
  await verificationRepo.create(guildId, request);
  logger.info(`✅ Solicitud de verificación creada via API: ${request.id}`);
}

export async function getVerificationRequest(
  guildId: string,
  id: string,
): Promise<IVerificationRequest | null> {
  return await verificationRepo.findById(guildId, id);
}

export async function updateVerificationRequest(
  guildId: string,
  id: string,
  updates: Partial<IVerificationRequest>,
): Promise<void> {
  await verificationRepo.update(guildId, id, updates);
  logger.info(`✅ Solicitud de verificación actualizada via API: ${id}`);
}

export async function getPendingRequests(
  guildId: string,
): Promise<IVerificationRequest[]> {
  return await verificationRepo.findPending(guildId);
}

export async function deleteVerificationRequest(
  guildId: string,
  id: string,
): Promise<void> {
  await verificationRepo.delete(guildId, id);
  logger.info(`🗑️ Solicitud de verificación eliminada via API: ${id}`);
}
