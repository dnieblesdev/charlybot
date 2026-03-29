import { describe, it, expect } from "vitest";
import { ClassConfigSchema } from "@charlybot/shared";

describe("Class Config Schema Validation", () => {
  it("T6.8: should accept valid class config", () => {
    const validData = {
      guildId: "guild-123",
      name: "Warrior",
      roleId: "role-warrior",
      type: "Tank" as "Healer" | "DPS" | "Tank",
      typeRoleId: "role-tank",
      subclasses: [
        { name: "Paladin", roleId: "role-paladin", guildId: "guild-123" },
        { name: "Berserker", roleId: "role-berserker", guildId: "guild-123" },
      ],
    };

    const result = ClassConfigSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.8b: should accept class without subclasses", () => {
    const validData = {
      guildId: "guild-123",
      name: "Warrior",
      roleId: "role-warrior",
      type: "Tank",
      typeRoleId: "role-tank",
      subclasses: [],
    };

    const result = ClassConfigSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.8c: should reject missing required fields", () => {
    const missingFields = {
      guildId: "guild-123",
      // Missing name, roleId, type, typeRoleId
    };

    const result = ClassConfigSchema.safeParse(missingFields);
    expect(result.success).toBe(false);
  });

  it("T6.8d: should reject invalid subclass structure", () => {
    const invalidData = {
      guildId: "guild-123",
      name: "Warrior",
      roleId: "role-warrior",
      type: "Tank" as "Healer" | "DPS" | "Tank",
      typeRoleId: "role-tank",
      subclasses: [
        { invalidField: "value" }, // Missing required fields
      ],
    };

    const result = ClassConfigSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
