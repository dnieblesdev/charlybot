import { z } from 'zod';

export const VerificationRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  guildId: z.string(),
  inGameName: z.string(),
  screenshotUrl: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  requestedAt: z.union([z.string().datetime(), z.date()]).optional(),
  messageId: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.union([z.string().datetime(), z.date()]).optional(),
});

export type IVerificationRequest = z.infer<typeof VerificationRequestSchema>;
