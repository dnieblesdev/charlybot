import type { IVerificationRequest } from "@charlybot/shared";

export interface IVerificationRepository {
  create(guildId: string, request: IVerificationRequest): Promise<void>;
  findById(guildId: string, id: string): Promise<IVerificationRequest | null>;
  update(guildId: string, id: string, updates: Partial<IVerificationRequest>): Promise<void>;
  findPending(guildId: string): Promise<IVerificationRequest[]>;
  delete(guildId: string, id: string): Promise<void>;
}
