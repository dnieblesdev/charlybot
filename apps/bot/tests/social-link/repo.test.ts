import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@charlybot/shared";
import {
  setSocialLink,
  removeSocialLink,
  listSocialLinks,
  getSocialLink,
} from "../../src/config/repositories/SocialLinkRepo";

// Access the mocked prisma from setup.ts
const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SocialLinkRepo", () => {
  const guildId = "guild-1";
  const platform = "twitch";
  const url = "https://twitch.tv/test";

  describe("setSocialLink", () => {
    it("creates a new social link via upsert transaction", async () => {
      await setSocialLink(guildId, platform, url);

      // Should have called $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();

      // Get the transaction callback
      const txCb = vi.mocked(mockPrisma.$transaction).mock.calls[0]?.[0] as Function;
      expect(txCb).toBeDefined();
    });

    it("upserts guild and social link inside transaction", async () => {
      const txSpy = { guild: { upsert: vi.fn() }, socialLink: { upsert: vi.fn() } };
      vi.mocked(mockPrisma.$transaction).mockImplementationOnce((cb: any) => cb(txSpy));

      await setSocialLink(guildId, platform, url);

      expect(txSpy.guild.upsert).toHaveBeenCalledWith({
        where: { guildId },
        update: {},
        create: { guildId },
      });
      expect(txSpy.socialLink.upsert).toHaveBeenCalledWith({
        where: { guildId_platform: { guildId, platform } },
        update: { url },
        create: { guildId, platform, url },
      });
    });
  });

  describe("removeSocialLink", () => {
    it("deletes a social link by guild and platform", async () => {
      await removeSocialLink(guildId, platform);

      expect(mockPrisma.socialLink.delete).toHaveBeenCalledWith({
        where: { guildId_platform: { guildId, platform } },
      });
    });
  });

  describe("listSocialLinks", () => {
    it("returns a Map of platform → url", async () => {
      vi.mocked(mockPrisma.socialLink.findMany).mockResolvedValueOnce([
        { platform: "twitch", url: "https://twitch.tv/a" },
        { platform: "kick", url: "https://kick.com/b" },
      ]);

      const result = await listSocialLinks(guildId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get("twitch")).toBe("https://twitch.tv/a");
      expect(result.get("kick")).toBe("https://kick.com/b");
    });

    it("returns empty Map when no links exist", async () => {
      vi.mocked(mockPrisma.socialLink.findMany).mockResolvedValueOnce([]);

      const result = await listSocialLinks(guildId);

      expect(result.size).toBe(0);
    });
  });

  describe("getSocialLink", () => {
    it("returns URL for existing link", async () => {
      vi.mocked(mockPrisma.socialLink.findUnique).mockResolvedValueOnce({
        url: "https://twitch.tv/test",
        platform: "twitch",
      } as any);

      const result = await getSocialLink(guildId, platform);

      expect(result).toBe("https://twitch.tv/test");
    });

    it("returns null for non-existent link", async () => {
      vi.mocked(mockPrisma.socialLink.findUnique).mockResolvedValueOnce(null);

      const result = await getSocialLink(guildId, "nonexistent");

      expect(result).toBeNull();
    });
  });
});
