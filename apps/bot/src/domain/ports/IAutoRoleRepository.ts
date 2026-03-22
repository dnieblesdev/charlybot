import type {
  AutoRole,
  RoleMapping,
  IAutoRole,
  IRoleMapping,
} from "@charlybot/shared";

export type AutoRoleWithMappings = AutoRole & { mappings: RoleMapping[] };

export interface IAutoRoleRepository {
  create(guildId: string, data: IAutoRole): Promise<AutoRoleWithMappings>;
  findByMessageId(
    guildId: string,
    messageId: string,
  ): Promise<AutoRoleWithMappings | null>;
  findByGuildId(guildId: string): Promise<AutoRoleWithMappings[]>;
  update(
    guildId: string,
    id: number,
    data: Partial<Omit<IAutoRole, "mappings">>,
  ): Promise<AutoRoleWithMappings>;
  delete(guildId: string, id: number): Promise<void>;
  deleteByMessageId(guildId: string, messageId: string): Promise<void>;

  addMapping(
    guildId: string,
    autoRoleId: number,
    data: IRoleMapping,
  ): Promise<RoleMapping>;
  removeMapping(guildId: string, id: number): Promise<void>;
  updateMapping(
    guildId: string,
    id: number,
    data: Partial<IRoleMapping>,
  ): Promise<RoleMapping>;
  removeAllMappings(guildId: string, autoRoleId: number): Promise<void>;
}
