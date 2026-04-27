import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@charlybot/shared";
import {
  createTestEconomyConfig,
  createTestUserEconomy,
  createTestRouletteGame,
  createTestRouletteBet,
  cleanupEconomyData,
  API_KEY,
  TEST_GUILD,
  generateTestId,
} from "./setup";
import app from "../../src/index";

describe("POST /api/v1/economy/roulette/game", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R1.1: should create a new roulette game with 201", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ guildId: TEST_GUILD.ID, channelId: "roulette-channel-1" }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { id?: number; guildId?: string; channelId?: string; status?: string };
    expect(body.guildId).toBe(TEST_GUILD.ID);
    expect(body.channelId).toBe("roulette-channel-1");
    expect(body.status).toBe("waiting");
  });

  it("R1.2: should return 400 when required fields are missing", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ guildId: TEST_GUILD.ID }),
        // channelId is missing
      })
    );

    expect(res.status).toBe(400);
  });

  it("R1.3: should return 401 when no API key is provided", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: TEST_GUILD.ID, channelId: "channel-1" }),
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/economy/roulette/game/:channelId/active", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R2.1: should return active game with 200", async () => {
    // Setup: create a waiting game
    const game = await createTestRouletteGame(TEST_GUILD.ID, "active-channel-1", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.channelId}/active`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { id?: number; channelId?: string; status?: string };
    expect(body.id).toBe(game.id);
    expect(body.channelId).toBe(game.channelId);
    expect(body.status).toBe("waiting");
  });

  it("R2.2: should return 404 when no active game exists", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game/non-existent-channel/active", {
        method: "GET",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("No active game");
  });

  it("R2.3: should return 401 when no API key is provided", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game/some-channel/active", {
        method: "GET",
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/economy/roulette/game/:gameId/bet", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R3.1: should place a bet successfully with 201", async () => {
    const userId = generateTestId("roulette-bet-user");
    // Create user economy (required for FK)
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 5000 });
    // Create a game
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-1", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { id?: number; gameId?: number; userId?: string; amount?: number; betType?: string };
    expect(body.gameId).toBe(game.id);
    expect(body.userId).toBe(userId);
    expect(body.amount).toBe(100);
    expect(body.betType).toBe("color");
  });

  it("R3.2: should return 400 when required fields are missing", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-2", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          userId: "some-user",
          guildId: TEST_GUILD.ID,
          // amount is missing
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R3.3: should return 400 when betType is invalid", async () => {
    const userId = generateTestId("roulette-invalid-type-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId);
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-3", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          amount: 100,
          betType: "invalid", // must be "color" or "number"
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R3.4: should return 500 when gameId is invalid (non-existent)", async () => {
    const userId = generateTestId("roulette-no-game-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId);

    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game/99999/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    expect(res.status).toBe(500);
  });

  it("R3.5: [KNOWN GAP] no balance validation - can bet without sufficient funds", async () => {
    const userId = generateTestId("roulette-no-money-user");
    // Create user with 0 pocket money
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 0 });
    const game = await createTestRouletteGame(TEST_GUILD.ID, "bet-channel-no-balance", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          amount: 10000, // More than user's pocket
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Current behavior: bet succeeds despite insufficient funds
    // Expected: 400 with "Insufficient funds"
    expect(res.status).toBe(201);
  });

  it("R3.6: [KNOWN GAP] no game state validation - can bet on finished games", async () => {
    const userId = generateTestId("roulette-finished-game-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId, { pocket: 5000 });
    // Create a finished game
    const game = await createTestRouletteGame(TEST_GUILD.ID, "finished-channel", { status: "finished" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          userId,
          guildId: TEST_GUILD.ID,
          amount: 100,
          betType: "color",
          betValue: "red",
        }),
      })
    );

    // Current behavior: bet succeeds on finished game
    // Expected: 400 with "Game is not accepting bets"
    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/v1/economy/roulette/game/:gameId", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R4.1: should update game state successfully with 200", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "update-channel-1", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ status: "spinning" }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { id?: number; status?: string };
    expect(body.id).toBe(game.id);
    expect(body.status).toBe("spinning");
  });

  it("R4.2: should update game with winning number and color", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "update-channel-2", { status: "spinning" });

    // NOTE: RouletteGamePatchSchema has 'result' (phantom, not in Prisma) instead of 'winningColor'
    // The Zod schema does not recognize winningColor, so it is silently ignored.
    // This is a schema-model mismatch bug.
    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          status: "finished",
          winningNumber: 17,
          winningColor: "black", // Zod schema ignores this (phantom 'result' field instead)
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { status?: string; winningNumber?: number; winningColor?: string | null };
    expect(body.status).toBe("finished");
    expect(body.winningNumber).toBe(17);
    // winningColor stays null because Zod schema does not pass it to Prisma
    expect(body.winningColor).toBeNull();
  });

  it("R4.3: should return 500 when game is not found", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game/99999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ status: "spinning" }),
      })
    );

    expect(res.status).toBe(500);
  });

  it("R4.4: should return 400 when status is invalid", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "update-channel-3", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ status: "invalid-status" }),
      })
    );

    expect(res.status).toBe(400);
  });

  it("R4.5: [KNOWN GAP] no state transition validation - can go from waiting to finished directly", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "invalid-transition-channel", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({
          status: "finished", // Should require: waiting -> spinning -> finished
          winningNumber: 7,
        }),
      })
    );

    // Current behavior: allows invalid state transition
    // Expected: 400 with "Invalid state transition"
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/economy/roulette/game/:gameId", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R5.1: should return game with bets with 200", async () => {
    const userId1 = generateTestId("game-view-user-1");
    const userId2 = generateTestId("game-view-user-2");
    await createTestUserEconomy(TEST_GUILD.ID, userId1);
    await createTestUserEconomy(TEST_GUILD.ID, userId2);

    const game = await createTestRouletteGame(TEST_GUILD.ID, "view-channel-1", { status: "waiting" });
    await createTestRouletteBet(game.id, userId1, TEST_GUILD.ID, { amount: 100, betValue: "red" });
    await createTestRouletteBet(game.id, userId2, TEST_GUILD.ID, { amount: 200, betValue: "black" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { id?: number; bets?: Array<unknown> };
    expect(body.id).toBe(game.id);
    expect(Array.isArray(body.bets)).toBe(true);
    expect(body.bets?.length).toBe(2);
  });

  it("R5.2: should return 404 when game is not found", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game/99999", {
        method: "GET",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("Not found");
  });

  it("R5.3: should return 401 when no API key is provided", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "view-channel-no-auth", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "GET",
      })
    );

    expect(res.status).toBe(401);
  });

  it("R5.4: [KNOWN GAP] bet list capped at 100 with silent truncation", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "view-channel-100-bets", { status: "waiting" });

    // Create 150 bets
    for (let i = 0; i < 150; i++) {
      const userId = generateTestId(`bet-cap-user-${i}`);
      await createTestUserEconomy(TEST_GUILD.ID, userId);
      await createTestRouletteBet(game.id, userId, TEST_GUILD.ID, { amount: 10 + i });
    }

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "GET",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { bets?: Array<unknown> };
    // Current behavior: silently truncates to 100 bets (take: 100 in query)
    // Expected: either return all with pagination, or at least indicate truncation
    expect(body.bets?.length).toBe(100);
  });
});

describe("PATCH /api/v1/economy/roulette/bet/:betId", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R6.1: should resolve bet successfully with 200", async () => {
    const userId = generateTestId("resolve-bet-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId);
    const game = await createTestRouletteGame(TEST_GUILD.ID, "resolve-channel-1", { status: "spinning" });
    const bet = await createTestRouletteBet(game.id, userId, TEST_GUILD.ID, { amount: 100, betValue: "red" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/bet/${bet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ result: "win", winAmount: 200 }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { id?: number; result?: string; winAmount?: number };
    expect(body.id).toBe(bet.id);
    expect(body.result).toBe("win");
    expect(body.winAmount).toBe(200);
  });

  it("R6.2: should resolve bet as lose with 200", async () => {
    const userId = generateTestId("lose-bet-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId);
    const game = await createTestRouletteGame(TEST_GUILD.ID, "resolve-channel-2", { status: "spinning" });
    const bet = await createTestRouletteBet(game.id, userId, TEST_GUILD.ID, { amount: 100, betValue: "red" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/bet/${bet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ result: "lose", winAmount: 0 }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { result?: string; winAmount?: number };
    expect(body.result).toBe("lose");
    expect(body.winAmount).toBe(0);
  });

  it("R6.3: should return 500 when bet is not found", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/bet/99999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ result: "win", winAmount: 100 }),
      })
    );

    expect(res.status).toBe(500);
  });

  it("R6.4: should return 400 when result is invalid", async () => {
    const userId = generateTestId("invalid-result-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId);
    const game = await createTestRouletteGame(TEST_GUILD.ID, "invalid-result-channel", { status: "spinning" });
    const bet = await createTestRouletteBet(game.id, userId, TEST_GUILD.ID);

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/bet/${bet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body: JSON.stringify({ result: "invalid-result" }),
      })
    );

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/v1/economy/roulette/game/:gameId", () => {
  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("R7.1: should delete game and cascade bets with 200", async () => {
    const userId1 = generateTestId("delete-game-user-1");
    const userId2 = generateTestId("delete-game-user-2");
    await createTestUserEconomy(TEST_GUILD.ID, userId1);
    await createTestUserEconomy(TEST_GUILD.ID, userId2);

    const game = await createTestRouletteGame(TEST_GUILD.ID, "delete-channel-1", { status: "waiting" });
    await createTestRouletteBet(game.id, userId1, TEST_GUILD.ID);
    await createTestRouletteBet(game.id, userId2, TEST_GUILD.ID);

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { message?: string };
    expect(body.message).toBe("Deleted");

    // Verify game is deleted
    const deletedGame = await prisma.rouletteGame.findUnique({ where: { id: game.id } });
    expect(deletedGame).toBeNull();

    // Verify bets are cascade deleted
    const remainingBets = await prisma.rouletteBet.findMany({ where: { gameId: game.id } });
    expect(remainingBets.length).toBe(0);
  });

  it("R7.2: should return 500 when game is not found", async () => {
    const res = await app.fetch(
      new Request("/api/v1/economy/roulette/game/99999", {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(500);
  });

  it("R7.3: should return 401 when no API key is provided", async () => {
    const game = await createTestRouletteGame(TEST_GUILD.ID, "delete-channel-no-auth", { status: "waiting" });

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "DELETE",
      })
    );

    expect(res.status).toBe(401);
  });

  it("R7.4: [KNOWN GAP] no transaction wrapper - potential for orphan bets on partial failure", async () => {
    const userId = generateTestId("orphan-bet-user");
    await createTestUserEconomy(TEST_GUILD.ID, userId);

    // Create a game with a bet
    const game = await createTestRouletteGame(TEST_GUILD.ID, "orphan-channel", { status: "waiting" });
    await createTestRouletteBet(game.id, userId, TEST_GUILD.ID);

    // The current implementation does deleteMany + delete sequentially without transaction
    // If deleteMany succeeds but delete fails, bets would be orphaned
    // However in practice, Prisma's default behavior makes this hard to trigger in tests
    // This documents the known architectural gap

    const res = await app.fetch(
      new Request(`/api/v1/economy/roulette/game/${game.id}`, {
        method: "DELETE",
        headers: { "X-API-Key": API_KEY },
      })
    );

    expect(res.status).toBe(200);
    // The actual behavior works because both operations succeed
    // But the code is not atomic - should use $transaction
  });
});
