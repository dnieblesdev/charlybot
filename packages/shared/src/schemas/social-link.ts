import { z } from "zod";

export const SocialLinkSchema = z.object({
  guildId: z.string(),
  platform: z.string().min(1),
  url: z.string().min(1),
});

export type ISocialLink = z.infer<typeof SocialLinkSchema>;