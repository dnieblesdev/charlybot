import { z } from 'zod';

export const RoleMappingSchema = z.object({
  roleId: z.string(),
  type: z.enum(["reaction", "button"]),
  emoji: z.string().nullable().optional(),
  buttonLabel: z.string().nullable().optional(),
  buttonStyle: z.string().nullable().optional(),
  order: z.number(),
});

export const AutoRoleSchema = z.object({
  guildId: z.string(),
  channelId: z.string(),
  messageId: z.string(),
  mode: z.enum(["multiple", "unique"]),
  embedTitle: z.string().nullable().optional(),
  embedDesc: z.string().nullable().optional(),
  embedColor: z.string().nullable().optional(),
  embedFooter: z.string().nullable().optional(),
  embedThumb: z.string().nullable().optional(),
  embedImage: z.string().nullable().optional(),
  embedTimestamp: z.boolean().nullable().optional(),
  embedAuthor: z.string().nullable().optional(),
  createdBy: z.string(),
  mappings: z.array(RoleMappingSchema),
});

export type IRoleMapping = z.infer<typeof RoleMappingSchema>;
export type IAutoRole = z.infer<typeof AutoRoleSchema>;
