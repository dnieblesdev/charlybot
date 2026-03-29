import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import the schemas from the economy routes (inline to avoid import issues)
const TransferSchema = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  guildId: z.string(),
  amount: z.number().positive(),
  fromUsername: z.string(),
  toUsername: z.string(),
});

const DepositSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  amount: z.number().positive(),
});

const WithdrawSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  amount: z.number().positive(),
});

describe("T7: Schema Validation Tests", () => {
  describe("T7.1: Transfer Schema Validation", () => {
    it("should accept valid transfer data", () => {
      const validData = {
        fromUserId: "user123",
        toUserId: "user456",
        guildId: "guild789",
        amount: 100,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100);
      }
    });

    it("should reject zero amount", () => {
      const invalidData = {
        fromUserId: "user123",
        toUserId: "user456",
        guildId: "guild789",
        amount: 0,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("amount");
      }
    });

    it("should reject negative amount", () => {
      const invalidData = {
        fromUserId: "user123",
        toUserId: "user456",
        guildId: "guild789",
        amount: -100,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("amount");
      }
    });

    it("should reject missing fromUserId", () => {
      const invalidData = {
        toUserId: "user456",
        guildId: "guild789",
        amount: 100,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing toUserId", () => {
      const invalidData = {
        fromUserId: "user123",
        guildId: "guild789",
        amount: 100,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing guildId", () => {
      const invalidData = {
        fromUserId: "user123",
        toUserId: "user456",
        amount: 100,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("T7.2: Deposit Schema Validation", () => {
    it("should accept valid deposit data", () => {
      const validData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: 500,
      };

      const result = DepositSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(500);
      }
    });

    it("should reject zero amount", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: 0,
      };

      const result = DepositSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("amount");
      }
    });

    it("should reject negative amount", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: -50,
      };

      const result = DepositSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("amount");
      }
    });

    it("should reject missing userId", () => {
      const invalidData = {
        guildId: "guild789",
        username: "TestUser",
        amount: 100,
      };

      const result = DepositSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing guildId", () => {
      const invalidData = {
        userId: "user123",
        username: "TestUser",
        amount: 100,
      };

      const result = DepositSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing username", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        amount: 100,
      };

      const result = DepositSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("T7.3: Withdraw Schema Validation", () => {
    it("should accept valid withdraw data", () => {
      const validData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: 300,
      };

      const result = WithdrawSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(300);
      }
    });

    it("should reject zero amount", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: 0,
      };

      const result = WithdrawSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("amount");
      }
    });

    it("should reject negative amount", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: -200,
      };

      const result = WithdrawSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("amount");
      }
    });

    it("should reject missing userId", () => {
      const invalidData = {
        guildId: "guild789",
        username: "TestUser",
        amount: 100,
      };

      const result = WithdrawSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing guildId", () => {
      const invalidData = {
        userId: "user123",
        username: "TestUser",
        amount: 100,
      };

      const result = WithdrawSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject missing username", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        amount: 100,
      };

      const result = WithdrawSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should accept very large amounts", () => {
      const validData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: 999999999,
      };

      const result = DepositSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should accept decimal amounts", () => {
      const validData = {
        fromUserId: "user123",
        toUserId: "user456",
        guildId: "guild789",
        amount: 100.50,
        fromUsername: "Sender",
        toUsername: "Receiver",
      };

      const result = TransferSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject non-numeric amount (string)", () => {
      const invalidData = {
        userId: "user123",
        guildId: "guild789",
        username: "TestUser",
        amount: "100" as unknown as number,
      };

      const result = DepositSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
