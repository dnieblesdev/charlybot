import { describe, it, expect } from "vitest";
import { AutoRoleSchema, RoleMappingSchema } from "@charlybot/shared";

describe("Role Mapping Schema Validation", () => {
  it("T6.6: should accept valid reaction mapping", () => {
    const validData = {
      roleId: "role-123",
      type: "reaction" as const,
      emoji: "1️⃣",
      order: 1,
    };

    const result = RoleMappingSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.6b: should accept valid button mapping", () => {
    const validData = {
      roleId: "role-456",
      type: "button" as const,
      buttonLabel: "Click Me",
      buttonStyle: "primary",
      order: 2,
    };

    const result = RoleMappingSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.6c: should reject invalid type", () => {
    const invalidData = {
      roleId: "role-123",
      type: "invalid-type",
      order: 1,
    };

    const result = RoleMappingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("T6.6d: should reject missing order", () => {
    const invalidData = {
      roleId: "role-123",
      type: "reaction" as const,
    };

    const result = RoleMappingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("Auto Role Schema Validation", () => {
  it("T6.7: should accept valid autorole", () => {
    const validData = {
      guildId: "guild-123",
      messageId: "msg-456",
      channelId: "channel-789",
      createdBy: "admin",
      mode: "multiple" as const,
      mappings: [
        { roleId: "role-1", type: "reaction" as const, emoji: "1️⃣", order: 1 },
        { roleId: "role-2", type: "button" as const, buttonLabel: "Button", buttonStyle: "primary", order: 2 },
      ],
    };

    const result = AutoRoleSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.7b: should reject invalid mode", () => {
    const invalidData = {
      guildId: "guild-123",
      messageId: "msg-456",
      channelId: "channel-789",
      createdBy: "admin",
      mode: "invalid-mode",
    };

    const result = AutoRoleSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("T6.7c: should accept empty mappings array (Zod default)", () => {
    const dataWithEmptyMappings = {
      guildId: "guild-123",
      messageId: "msg-456",
      channelId: "channel-789",
      createdBy: "admin",
      mode: "multiple" as const,
      mappings: [],
    };

    // Zod doesn't reject empty arrays by default
    const result = AutoRoleSchema.safeParse(dataWithEmptyMappings);
    expect(result.success).toBe(true);
  });

  it("T6.7d: should reject missing required fields", () => {
    const missingFields = {
      guildId: "guild-123",
      // Missing messageId, channelId, createdBy, mode, mappings
    };

    const result = AutoRoleSchema.safeParse(missingFields);
    expect(result.success).toBe(false);
  });
});
