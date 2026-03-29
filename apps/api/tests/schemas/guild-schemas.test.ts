import { describe, it, expect } from "vitest";
import { GuildConfigSchema } from "@charlybot/shared";

describe("Guild Config Schema Validation", () => {
  it("T6.1: should accept valid guild config", () => {
    const validData = {
      guildId: "guild-123",
      welcomeChannelId: "channel-456",
      welcomeMessage: "Welcome {user}!",
      verificationChannelId: "verif-channel",
      verifiedRoleId: "role-789",
    };

    const result = GuildConfigSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.1b: should accept partial guild config (optional fields)", () => {
    const partialData = {
      guildId: "guild-123",
    };

    const result = GuildConfigSchema.partial().safeParse(partialData);
    expect(result.success).toBe(true);
  });

  it("T6.1c: should reject invalid data types", () => {
    const invalidData = {
      guildId: 123, // Should be string
      welcomeChannelId: "channel",
    };

    const result = GuildConfigSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("T6.1d: should handle unknown fields gracefully (Zod default passthrough)", () => {
    const unknownFieldData = {
      guildId: "guild-123",
      unknownField: "not allowed",
    };

    const result = GuildConfigSchema.safeParse(unknownFieldData);
    // Zod doesn't reject unknown fields by default
    expect(result.success).toBe(true);
  });
});
