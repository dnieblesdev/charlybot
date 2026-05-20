import { z } from 'zod';

// Anti-spam pattern action enum
export const AntiSpamActionSchema = z.enum([
  'warn',
  'timeout_5min',
  'timeout_30min',
  'notify_only',
  'delete_only',
]);
export type IAntiSpamAction = z.infer<typeof AntiSpamActionSchema>;

// Anti-spam pattern enum
export const AntiSpamPatternSchema = z.enum([
  'burst',
  'duplicate',
  'mention',
  'link',
  'caps',
  'emoji',
  'combo',
]);
export type IAntiSpamPattern = z.infer<typeof AntiSpamPatternSchema>;

// AntiSpamConfig schema - mirrors Prisma AntiSpamConfig model
export const AntiSpamConfigSchema = z.object({
  id: z.number().int().optional(),
  guildId: z.string(),

  // Master toggle
  enabled: z.boolean().default(true),

  // Per-pattern toggles
  burstEnabled: z.boolean().default(true),
  duplicateEnabled: z.boolean().default(true),
  mentionEnabled: z.boolean().default(true),
  linkEnabled: z.boolean().default(true),
  capsEnabled: z.boolean().default(true),
  emojiEnabled: z.boolean().default(false),
  comboEnabled: z.boolean().default(false),

  // Per-pattern actions
  burstAction: AntiSpamActionSchema.default('warn'),
  duplicateAction: AntiSpamActionSchema.default('warn'),
  mentionAction: AntiSpamActionSchema.default('timeout_5min'),
  linkAction: AntiSpamActionSchema.default('timeout_5min'),
  capsAction: AntiSpamActionSchema.default('warn'),
  emojiAction: AntiSpamActionSchema.default('warn'),
  comboAction: AntiSpamActionSchema.default('timeout_5min'),

  // Escalation settings
  escalationEnabled: z.boolean().default(true),
  escalationCount: z.number().int().default(3),

  // Notification settings
  notifyOnSpam: z.boolean().default(true),

  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type IAntiSpamConfig = z.infer<typeof AntiSpamConfigSchema>;

// AntiSpamHistory schema - mirrors Prisma AntiSpamHistory model
export const AntiSpamHistorySchema = z.object({
  id: z.number().int().optional(),
  guildId: z.string(),
  userId: z.string(),
  pattern: AntiSpamPatternSchema,
  action: AntiSpamActionSchema,
  reason: z.string().nullable().optional(),
  createdAt: z.date().optional(),
});
export type IAntiSpamHistory = z.infer<typeof AntiSpamHistorySchema>;