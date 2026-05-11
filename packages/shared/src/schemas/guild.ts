import { z } from 'zod';

export const GuildConfigSchema = z.object({
  guildId: z.string(),
  name: z.string().nullable().optional(),
  targetChannelId: z.string().nullable().optional(),
  voiceLogChannelId: z.string().nullable().optional(),
  welcomeChannelId: z.string().nullable().optional(),
  welcomeMessage: z.string().nullable().optional(),
  leaveLogChannelId: z.string().nullable().optional(),
  verificationChannelId: z.string().nullable().optional(),
  verificationReviewChannelId: z.string().nullable().optional(),
  verifiedRoleId: z.string().nullable().optional(),
  messageLogChannelId: z.string().nullable().optional(),
  modLogChannelId: z.string().nullable().optional(),
  modRoleId: z.string().nullable().optional(),
  antispamEnabled: z.boolean().default(true),
});

export type IGuildConfig = z.infer<typeof GuildConfigSchema>;
