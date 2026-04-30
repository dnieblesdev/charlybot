import { describe, it, expect } from "vitest";
import { TransferSchema, DepositSchema, WithdrawSchema, AddPocketSchema, SubtractPocketSchema, CooldownClaimSchema, AtomicRouletteBetSchema, RouletteProcessResultsSchema, RouletteCancelGameSchema } from "@charlybot/shared";

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
        expect(result.error.issues[0]!.path).toContain("amount");
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
        expect(result.error.issues[0]!.path).toContain("amount");
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
        expect(result.error.issues[0]!.path).toContain("amount");
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
        expect(result.error.issues[0]!.path).toContain("amount");
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
        expect(result.error.issues[0]!.path).toContain("amount");
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
        expect(result.error.issues[0]!.path).toContain("amount");
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

describe("T7.4: AddPocket Schema Validation", () => {
  it("should accept valid add-pocket data", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      amount: 100,
    };

    const result = AddPocketSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100);
    }
  });

  it("should accept add-pocket with cooldownType", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      amount: 100,
      cooldownType: "work",
    };

    const result = AddPocketSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cooldownType).toBe("work");
    }
  });

  it("should accept add-pocket with cooldownType crime", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      amount: 100,
      cooldownType: "crime",
    };

    const result = AddPocketSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept add-pocket with cooldownType rob", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      amount: 100,
      cooldownType: "rob",
    };

    const result = AddPocketSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject zero amount", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      amount: 0,
    };

    const result = AddPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      amount: -50,
    };

    const result = AddPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject invalid cooldownType", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      amount: 100,
      cooldownType: "invalid",
    };

    const result = AddPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject missing userId", () => {
    const invalidData = {
      guildId: "guild789",
      amount: 100,
    };

    const result = AddPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject missing guildId", () => {
    const invalidData = {
      userId: "user123",
      amount: 100,
    };

    const result = AddPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("T7.5: SubtractPocket Schema Validation", () => {
  it("should accept valid subtract-pocket data", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      amount: 50,
    };

    const result = SubtractPocketSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept subtract-pocket with cooldownType", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      amount: 50,
      cooldownType: "work",
    };

    const result = SubtractPocketSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject zero amount", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      amount: 0,
    };

    const result = SubtractPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      amount: -25,
    };

    const result = SubtractPocketSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("T7.6: CooldownClaim Schema Validation", () => {
  it("should accept valid cooldown-claim data", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      type: "work",
      cooldownMs: 300000,
    };

    const result = CooldownClaimSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept cooldown type crime", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      type: "crime",
      cooldownMs: 900000,
    };

    const result = CooldownClaimSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept cooldown type rob", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      type: "rob",
      cooldownMs: 1800000,
    };

    const result = CooldownClaimSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid type", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      type: "invalid",
      cooldownMs: 300000,
    };

    const result = CooldownClaimSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject zero cooldownMs", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      type: "work",
      cooldownMs: 0,
    };

    const result = CooldownClaimSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject negative cooldownMs", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      type: "work",
      cooldownMs: -1000,
    };

    const result = CooldownClaimSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("T7.7: AtomicRouletteBet Schema Validation", () => {
  it("should accept valid color bet (red)", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "color",
      betValue: "red",
    };

    const result = AtomicRouletteBetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept valid color bet (black)", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "color",
      betValue: "black",
    };

    const result = AtomicRouletteBetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept valid color bet (green)", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "color",
      betValue: "green",
    };

    const result = AtomicRouletteBetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept valid number bet", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "number",
      betValue: "17",
    };

    const result = AtomicRouletteBetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept number bet 0", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "number",
      betValue: "0",
    };

    const result = AtomicRouletteBetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept number bet 36", () => {
    const validData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "number",
      betValue: "36",
    };

    const result = AtomicRouletteBetSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid betType", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 100,
      betType: "invalid",
      betValue: "red",
    };

    const result = AtomicRouletteBetSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject zero amount", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: 0,
      betType: "color",
      betValue: "red",
    };

    const result = AtomicRouletteBetSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      gameId: 1,
      amount: -50,
      betType: "color",
      betValue: "red",
    };

    const result = AtomicRouletteBetSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject missing gameId", () => {
    const invalidData = {
      userId: "user123",
      guildId: "guild789",
      amount: 100,
      betType: "color",
      betValue: "red",
    };

    const result = AtomicRouletteBetSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("T7.8: RouletteProcessResults Schema Validation", () => {
  it("should accept valid process-results data", () => {
    const validData = {
      gameId: 1,
      guildId: "guild789",
      winningNumber: 17,
      winningColor: "red",
    };

    const result = RouletteProcessResultsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept winningNumber 0 (green)", () => {
    const validData = {
      gameId: 1,
      guildId: "guild789",
      winningNumber: 0,
      winningColor: "green",
    };

    const result = RouletteProcessResultsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept winningNumber 36", () => {
    const validData = {
      gameId: 1,
      guildId: "guild789",
      winningNumber: 36,
      winningColor: "black",
    };

    const result = RouletteProcessResultsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject winningNumber less than 0", () => {
    const invalidData = {
      gameId: 1,
      guildId: "guild789",
      winningNumber: -1,
      winningColor: "red",
    };

    const result = RouletteProcessResultsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject winningNumber greater than 36", () => {
    const invalidData = {
      gameId: 1,
      guildId: "guild789",
      winningNumber: 37,
      winningColor: "red",
    };

    const result = RouletteProcessResultsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject non-integer winningNumber", () => {
    const invalidData = {
      gameId: 1,
      guildId: "guild789",
      winningNumber: 17.5,
      winningColor: "red",
    };

    const result = RouletteProcessResultsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("T7.9: RouletteCancelGame Schema Validation", () => {
  it("should accept valid cancel-game data", () => {
    const validData = {
      gameId: 1,
      guildId: "guild789",
    };

    const result = RouletteCancelGameSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject missing gameId", () => {
    const invalidData = {
      guildId: "guild789",
    };

    const result = RouletteCancelGameSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject missing guildId", () => {
    const invalidData = {
      gameId: 1,
    };

    const result = RouletteCancelGameSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
