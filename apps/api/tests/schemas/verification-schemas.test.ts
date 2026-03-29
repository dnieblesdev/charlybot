import { describe, it, expect } from "vitest";
import { VerificationRequestSchema } from "@charlybot/shared";

describe("Verification Request Schema Validation", () => {
  it("T6.2: should accept valid verification request", () => {
    const validData = {
      id: "verif-123",
      guildId: "guild-456",
      userId: "user-789",
      inGameName: "PlayerOne",
      screenshotUrl: "https://example.com/screenshot.png",
      status: "pending",
    };

    const result = VerificationRequestSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.2b: should accept approved status", () => {
    const approvedData = {
      id: "verif-123",
      guildId: "guild-456",
      userId: "user-789",
      inGameName: "PlayerOne",
      screenshotUrl: "https://example.com/screen.png",
      status: "approved",
      reviewedBy: "admin",
      reviewedAt: new Date().toISOString(),
    };

    const result = VerificationRequestSchema.safeParse(approvedData);
    expect(result.success).toBe(true);
  });

  it("T6.2c: should reject invalid status", () => {
    const invalidData = {
      id: "verif-123",
      guildId: "guild-456",
      userId: "user-789",
      inGameName: "PlayerOne",
      screenshotUrl: "https://example.com/screen.png",
      status: "invalid-status",
    };

    const result = VerificationRequestSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("T6.2d: should reject missing required fields", () => {
    const missingFields = {
      guildId: "guild-456",
      // Missing userId, inGameName, screenshotUrl
    };

    const result = VerificationRequestSchema.safeParse(missingFields);
    expect(result.success).toBe(false);
  });
});
