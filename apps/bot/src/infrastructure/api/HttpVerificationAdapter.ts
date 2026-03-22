import type { IVerificationRequest } from "@charlybot/shared";
import type { IVerificationRepository } from "../../domain/ports/IVerificationRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";

export class HttpVerificationAdapter
  extends HttpRepositoryAdapter
  implements IVerificationRepository
{
  async create(guildId: string, request: IVerificationRequest): Promise<void> {
    await this.client.post("verifications", { json: { ...request, guildId } });
  }

  async findById(
    guildId: string,
    id: string,
  ): Promise<IVerificationRequest | null> {
    try {
      return await this.client
        .get(`verifications/${id}`)
        .json<IVerificationRequest>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async update(guildId: string, id: string, updates: Partial<IVerificationRequest>): Promise<void> {
    await this.client.patch(`verifications/${id}`, { json: updates });
  }

  async findPending(guildId: string): Promise<IVerificationRequest[]> {
    return await this.client
      .get(`verifications/pending/${guildId}`)
      .json<IVerificationRequest[]>();
  }

  async delete(guildId: string, id: string): Promise<void> {
    await this.client.delete(`verifications/${id}`);
  }
}
