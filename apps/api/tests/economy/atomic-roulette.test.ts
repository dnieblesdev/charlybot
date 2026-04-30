import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { prisma } from "@charlybot/shared";
import {
  createTestUserEconomy,
  createTestEconomyConfig,
  createTestRouletteGame,
  cleanupEconomyData,
  API_KEY,
  TEST_GUILD,
  generateTestId,
  isValkeyAvailable,
} from "./setup";
import app from "../../src/index";

let valkeyAvailable = false;

beforeAll(async () => {
  valkeyAvailable = await isValkeyAvailable();
});

describe("POST /api/v1/economy/roulette/atomic-place-bet", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R1.1: should reject zero amount", async () => {
    const userId = generateTestId("bet-zero-amount");
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 1000 });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-1", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 0,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R1.2: should reject negative amount", async () => {
    const userId = generateTestId("bet-negative-amount");
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 1000 });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-2", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: -50,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R1.3: should reject invalid betType", async () => {
    const userId = generateTestId("bet-invalid-type");
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 1000 });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-3", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "invalid",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R1.4: should handle non-existent game (or lock failure in fallback mode)", async () => {
    // Note: When Valkey unavailable and fallback lock fails, we get 429 instead of 400
    const userId = generateTestId("bet-no-game");
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 1000 });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: 99999,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Accept either 400 (game not found) or 429 (lock failure in fallback mode)
    expect([400, 429]).toContain(res.status);
  });
});

describe("POST /api/v1/economy/roulette/atomic-place-bet (with locking)", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it.skipIf(!valkeyAvailable)("R1.5: should place bet and deduct funds atomically", async () => {
    const userId = generateTestId("bet-basic");
    const initialPocket = 500;
    const betAmount = 100;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-basic-channel", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: betAmount,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { id?: number; amount?: number; betType?: string; betValue?: string };
    expect(body.amount).toBe(betAmount);
    expect(body.betType).toBe("color");
    expect(body.betValue).toBe("red");

    // Verify pocket was deducted
    const user = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(user?.pocket).toBe(initialPocket - betAmount);
  });

  it.skipIf(!valkeyAvailable)("R1.6: should reject when insufficient funds", async () => {
    const userId = generateTestId("bet-insufficient");
    const initialPocket = 50;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-insufficient-channel", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Insufficient");

    // Verify pocket unchanged
    const user = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(user?.pocket).toBe(initialPocket);
  });

  it.skipIf(!valkeyAvailable)("R1.7: should reject bet on finished game", async () => {
    const userId = generateTestId("bet-finished-game");
    const initialPocket = 500;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-finished-channel", { status: "finished" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/not found|already processed/i);
  });
});

describe("POST /api/v1/economy/roulette/atomic-process", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R2.1: should reject missing winningNumber", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "process-channel-1", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          // winningNumber missing
          winningColor: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R2.2: should reject invalid winningNumber (negative)", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "process-channel-2", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: -1,
          winningColor: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R2.3: should reject invalid winningNumber (>36)", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "process-channel-3", { status: "waiting" });

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: 37,
          winningColor: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R2.4: should handle non-existent game (or lock failure in fallback mode)", async () => {
    // Note: When Valkey unavailable and fallback lock fails, we get 429 instead of 400
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: 99999,
          guildId: TEST_GUILD.ID,
          winningNumber: 17,
          winningColor: "red",
        }),
      })
    );

    // Accept either 400 (game not found) or 429 (lock failure in fallback mode)
    expect([400, 429]).toContain(res.status);
  });
});

describe("POST /api/v1/economy/roulette/atomic-process (with locking)", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it.skipIf(!valkeyAvailable)("R2.5: should process bets and pay winners", async () => {
    const userId = generateTestId("process-bets-user");
    const initialPocket = 500;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "process-bets-channel", { status: "waiting" });

    // Place a bet on red
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Process results with red winning (17 is red)
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: 17,
          winningColor: "red",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { gameId?: number; results?: Array<{ won?: boolean }> };
    expect(body.gameId).toBe(game.id);
    expect(body.results).toBeDefined();
    expect(body.results!.length).toBe(1);
    expect(body.results![0].won).toBe(true);

    // Verify user got paid (2x bet for color win)
    const user = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(user?.pocket).toBe(initialPocket - 100 + 200); // Lost 100, won 200
  });

  it.skipIf(!valkeyAvailable)("R2.6: should mark losing bets correctly", async () => {
    const userId = generateTestId("process-losing-user");
    const initialPocket = 500;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "process-losing-channel", { status: "waiting" });

    // Place a bet on black
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "black",
        }),
      })
    );

    // Process results with red winning (17 is red)
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: 17,
          winningColor: "red",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { results?: Array<{ won?: boolean }> };
    expect(body.results![0].won).toBe(false);

    // User should have lost the bet amount
    const user = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(user?.pocket).toBe(initialPocket - 100); // Lost 100
  });

  it.skipIf(!valkeyAvailable)("R2.7: should reject processing already processed game", async () => {
    const userId = generateTestId("process-twice-user");
    const initialPocket = 500;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "process-twice-channel", { status: "waiting" });

    // Place a bet
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Process once
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: 17,
          winningColor: "red",
        }),
      })
    );

    // Try to process again
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: 5,
          winningColor: "black",
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/already processed|not found/i);
  });
});

describe("POST /api/v1/economy/roulette/atomic-cancel", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R3.1: should handle non-existent game (or lock failure in fallback mode)", async () => {
    // Note: When Valkey unavailable and fallback lock fails, we get 429 instead of 400
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: 99999,
          guildId: TEST_GUILD.ID,
        }),
      })
    );

    // Accept either 400 (game not found) or 429 (lock failure in fallback mode)
    expect([400, 429]).toContain(res.status);
  });
});

describe("POST /api/v1/economy/roulette/atomic-cancel (with locking)", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it.skipIf(!valkeyAvailable)("R3.2: should refund all bets and cancel game", async () => {
    const userId = generateTestId("cancel-bets-user");
    const initialPocket = 500;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "cancel-bets-channel", { status: "waiting" });

    // Place a bet
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Cancel the game
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { gameId?: number; refundedBets?: number };
    expect(body.gameId).toBe(game.id);
    expect(body.refundedBets).toBe(1);

    // User should be refunded
    const user = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    expect(user?.pocket).toBe(initialPocket); // Refunded, back to initial
  });

  it.skipIf(!valkeyAvailable)("R3.3: should reject cancel of already processed game", async () => {
    const userId = generateTestId("cancel-twice-user");
    const initialPocket = 500;

    await createTestUserEconomy(TEST_GUILD.ID, userId, { username: "BetUser", pocket: initialPocket });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "cancel-twice-channel", { status: "waiting" });

    // Place a bet
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-place-bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          gameId: game.id,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Process the game
    await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
          winningNumber: 17,
          winningColor: "red",
        }),
      })
    );

    // Try to cancel
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/atomic-cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          gameId: game.id,
          guildId: TEST_GUILD.ID,
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/already processed|not found/i);
  });
});