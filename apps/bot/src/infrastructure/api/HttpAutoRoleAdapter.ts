import type { AutoRole, RoleMapping, IAutoRole, IRoleMapping } from "@charlybot/shared";
import type { IAutoRoleRepository, AutoRoleWithMappings } from "../../domain/ports/IAutoRoleRepository";
import { HttpRepositoryAdapter } from "./HttpRepositoryAdapter";

export class HttpAutoRoleAdapter
  extends HttpRepositoryAdapter
  implements IAutoRoleRepository
{
  async create(guildId: string, data: IAutoRole): Promise<AutoRoleWithMappings> {
    return await this.client
      .post("autoroles", { json: { ...data, guildId } })
      .json<AutoRoleWithMappings>();
  }

  async findByMessageId(
    guildId: string,
    messageId: string,
  ): Promise<AutoRoleWithMappings | null> {
    try {
      return await this.client
        .get(`autoroles/message/${guildId}/${messageId}`)
        .json<AutoRoleWithMappings>();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error && (error.response as any)?.status === 404) return null;
      throw error;
    }
  }

  async findByGuildId(guildId: string): Promise<AutoRoleWithMappings[]> {
    return await this.client
      .get(`autoroles/guild/${guildId}`)
      .json<AutoRoleWithMappings[]>();
  }

  async update(
    guildId: string,
    id: number,
    data: Partial<Omit<IAutoRole, "mappings">>,
  ): Promise<AutoRoleWithMappings> {
    return await this.client
      .patch(`autoroles/${id}`, { json: data })
      .json<AutoRoleWithMappings>();
  }

  async delete(guildId: string, id: number): Promise<void> {
    await this.client.delete(`autoroles/${id}`);
  }

  async deleteByMessageId(guildId: string, messageId: string): Promise<void> {
    // We can either find and delete by id, or add a delete endpoint by messageId.
    // For now, let's find it first.
    const autorole = await this.findByMessageId(guildId, messageId);
    if (autorole?.id) {
      await this.delete(guildId, autorole.id);
    }
  }

  async addMapping(
    guildId: string,
    autoRoleId: number,
    data: IRoleMapping,
  ): Promise<RoleMapping> {
    return await this.client
      .post(`autoroles/${autoRoleId}/mappings`, { json: data })
      .json<RoleMapping>();
  }

  async removeMapping(guildId: string, id: number): Promise<void> {
    await this.client.delete(`autoroles/mappings/${id}`);
  }

  async updateMapping(
    guildId: string,
    id: number,
    data: Partial<IRoleMapping>,
  ): Promise<RoleMapping> {
    return await this.client
      .patch(`autoroles/mappings/${id}`, { json: data })
      .json<RoleMapping>();
  }

  async removeAllMappings(guildId: string, autoRoleId: number): Promise<void> {
    await this.client.delete(`autoroles/${autoRoleId}/mappings`);
  }
}
