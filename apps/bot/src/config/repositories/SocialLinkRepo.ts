import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";

/**
 * Sets or updates a social link for a guild.
 * If maxLinks is provided, enforces the limit atomically within the transaction
 * (skipping the check when updating an existing link for the same platform).
 */
export async function setSocialLink(
  guildId: string,
  platform: string,
  url: string,
  maxLinks?: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Enforce max links limit atomically
    if (maxLinks !== undefined) {
      const existing = await tx.socialLink.findUnique({
        where: { guildId_platform: { guildId, platform } },
        select: { platform: true },
      });
      if (!existing) {
        const count = await tx.socialLink.count({ where: { guildId } });
        if (count >= maxLinks) {
          throw new Error("MAX_LINKS_EXCEEDED");
        }
      }
    }

    // Ensure Guild exists
    await tx.guild.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });

    // Upsert the social link
    await tx.socialLink.upsert({
      where: { guildId_platform: { guildId, platform } },
      update: { url },
      create: { guildId, platform, url },
    });
  });

  logger.info(`✅ Social link set: [${guildId}] ${platform} → ${url}`);
}

/**
 * Removes a social link for a guild/platform.
 */
export async function removeSocialLink(
  guildId: string,
  platform: string,
): Promise<void> {
  await prisma.socialLink.delete({
    where: { guildId_platform: { guildId, platform } },
  });

  logger.info(`🗑️ Social link removed: [${guildId}] ${platform}`);
}

/**
 * Lists all social links for a guild.
 * Returns a Map of platform → url.
 */
export async function listSocialLinks(
  guildId: string,
): Promise<Map<string, string>> {
  const links = await prisma.socialLink.findMany({
    where: { guildId },
    select: { platform: true, url: true },
  });

  const map = new Map<string, string>();
  for (const link of links) {
    map.set(link.platform, link.url);
  }
  return map;
}

/**
 * Gets a single social link for a guild/platform.
 * Returns null if not found.
 */
export async function getSocialLink(
  guildId: string,
  platform: string,
): Promise<string | null> {
  const link = await prisma.socialLink.findUnique({
    where: { guildId_platform: { guildId, platform } },
    select: { url: true },
  });

  return link?.url ?? null;
}