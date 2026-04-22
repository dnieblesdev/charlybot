import { z } from 'zod';

export const UserXPSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  xp: z.number().int().default(0),
  nivel: z.number().int().default(0),
  lastMessageAt: z.union([z.date(), z.string().datetime()]).transform(val =>
    val instanceof Date ? val : new Date(val)
  ).optional(),
});

// Schema para incremento atómico de XP (evita race conditions)
export const XPIncrementSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string().optional(),
  xpIncrement: z.number().int().min(1),
  nivel: z.number().int().default(0),
  lastMessageAt: z.union([z.date(), z.string().datetime()]).transform(val =>
    val instanceof Date ? val : new Date(val)
  ).optional(),
});

export const XPConfigSchema = z.object({
  guildId: z.string(),
  xpPerMessage: z.number().int().min(1).default(1),
  enabled: z.boolean().default(true),
  levelUpChannelId: z.string().nullable().optional(),
  levelUpMessage: z.string().nullable().optional(),
});

export const LevelRoleSchema = z.object({
  guildId: z.string(),
  level: z.number().int().min(1),
  roleId: z.string(),
});

export type IUserXP = z.infer<typeof UserXPSchema>;
export type IXPConfig = z.infer<typeof XPConfigSchema>;
export type ILevelRole = z.infer<typeof LevelRoleSchema>;
export type IXPIncrement = z.infer<typeof XPIncrementSchema>;
