import { z } from 'zod';

// --- Enum ---

export const ModActionTypeSchema = z.enum([
  'warn',
  'ban',
  'kick',
  'timeout',
  'unban',
  'clear',
]);

export type ModActionType = z.infer<typeof ModActionTypeSchema>;

// --- Duration parser: "10m" | "1h" | "1d" → milliseconds ---

export const DurationSchema = z
  .string()
  .regex(/^(\d+)([smhd])$/, 'Formato inválido. Usá: 10m, 1h, 2d')
  .transform((str) => {
    const [, valueStr, unit] = str.match(/^(\d+)([smhd])$/) as [string, string, string];
    const value = parseInt(valueStr, 10);
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return BigInt(value * multipliers[unit]!);
  });

// --- ModCase ---

export const ModCaseSchema = z.object({
  id: z.number().int().positive().optional(),
  guildId: z.string().min(1),
  userId: z.string().min(1),
  moderatorId: z.string().min(1),
  caseNumber: z.number().int().positive(),
  type: ModActionTypeSchema,
  reason: z.string().max(1000).nullable().optional(),
  duration: z.bigint().nullable().optional(),
  active: z.boolean().default(true),
  messageCount: z.number().int().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type IModCase = z.infer<typeof ModCaseSchema>;

// --- WarnThreshold ---

export const WarnThresholdActionSchema = z.enum(['timeout', 'kick', 'ban']);

export type WarnThresholdAction = z.infer<typeof WarnThresholdActionSchema>;

export const WarnThresholdSchema = z.object({
  id: z.number().int().positive().optional(),
  guildId: z.string().min(1),
  warnCount: z.number().int().positive(),
  action: WarnThresholdActionSchema,
  duration: z.bigint().nullable().optional(),
});

export type IWarnThreshold = z.infer<typeof WarnThresholdSchema>;

// --- ModerationConfig (GuildConfig mod fields) ---

export const ModerationConfigSchema = z.object({
  modLogChannelId: z.string().nullable().optional(),
  modRoleId: z.string().nullable().optional(),
});

export type IModerationConfig = z.infer<typeof ModerationConfigSchema>;
