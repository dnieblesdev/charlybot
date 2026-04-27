import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestUserEconomy, createTestBank, createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId, isValkeyAvailable } from "./setup";
import app from "../../src/index";

describe("POST /api/v1/economy/transfer - Race Conditions (HTTP)", () => {
  const API_KEY_VALID = API_KEY;
  let valkeyAvailable = false;

  beforeAll(async () => {
    valkeyAvailable = await isValkeyAvailable();
  });

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S6.1: concurrent transfers should be handled correctly (in-memory lock)", async () => {
    const senderId = generateTestId("race-sender");
    const receiverId = generateTestId("race-receiver");
    const amount = 100;
    const numberOfTransfers = 5;

    // Setup: sender with 1000, receiver with 0
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "RaceSender",
      pocket: 1000,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "RaceReceiver",
      pocket: 0,
    });

    // Act: send concurrent transfer requests
    const results = await Promise.allSettled(
      Array.from({ length: numberOfTransfers }, () =>
        app.fetch(
          new Request("/api/v1/economy/transfer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": API_KEY_VALID,
            },
            body: JSON.stringify({
              fromUserId: senderId,
              toUserId: receiverId,
              guildId: TEST_GUILD.ID,
              amount,
              fromUsername: "RaceSender",
              toUsername: "RaceReceiver",
            }),
          })
        )
      )
    );

    // Count successful vs failed
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200)).length;

    // Get final balances
    const finalSender = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
    });
    const finalReceiver = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
    });

    // Sender should never go negative
    expect(finalSender?.pocket ?? 0).toBeGreaterThanOrEqual(0);

    // Total transferred should be successful * amount
    const transferred = 1000 - (finalSender?.pocket ?? 0);
    expect(transferred).toBe(successful * amount);

    // Receiver should have received exactly what sender lost
    expect(finalReceiver?.pocket ?? 0).toBe(successful * amount);

    console.log(`Successful: ${successful}, Failed: ${failed}, Final sender pocket: ${finalSender?.pocket}`);
  });

  it("S6.2: concurrent deposit+withdraw should maintain consistency", async () => {
    const userId = generateTestId("race-user");
    const initialPocket = 500;
    const initialBank = 500;
    const operationAmount = 100;
    const numOperations = 5;

    // Setup: user with pocket and bank
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username: "RaceUser",
      pocket: initialPocket,
    });
    await createTestBank(userId, { username: "RaceUser", bank: initialBank });

    // Act: concurrent deposit and withdraw operations
    const results = await Promise.allSettled(
      Array.from({ length: numOperations }, (_, i) => {
        if (i % 2 === 0) {
          // Deposit
          return app.fetch(
            new Request("/api/v1/economy/deposit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY_VALID,
              },
              body: JSON.stringify({
                userId,
                guildId: TEST_GUILD.ID,
                username: "RaceUser",
                amount: operationAmount,
              }),
            })
          );
        } else {
          // Withdraw
          return app.fetch(
            new Request("/api/v1/economy/withdraw", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY_VALID,
              },
              body: JSON.stringify({
                userId,
                guildId: TEST_GUILD.ID,
                username: "RaceUser",
                amount: operationAmount,
              }),
            })
          );
        }
      })
    );

    // Count successes
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200)).length;

    // Get final balances
    const finalUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    const finalBank = await prisma.globalBank.findUnique({
      where: { userId },
    });

    // Neither should go negative
    expect(finalUser?.pocket ?? 0).toBeGreaterThanOrEqual(0);
    expect(finalBank?.bank ?? 0).toBeGreaterThanOrEqual(0);

    // Pocket + Bank should equal initial total
    const finalTotal = (finalUser?.pocket ?? 0) + (finalBank?.bank ?? 0);
    const initialTotal = initialPocket + initialBank;
    expect(finalTotal).toBe(initialTotal);

    console.log(`Successful: ${successful}, Failed: ${failed}, Final pocket: ${finalUser?.pocket}, Final bank: ${finalBank?.bank}`);
  });
});

describe("Race Conditions - Distributed Lock Tests (requires Valkey)", () => {
  const API_KEY_VALID = API_KEY;
  let valkeyAvailable = false;

  beforeAll(async () => {
    valkeyAvailable = await isValkeyAvailable();
  });

  beforeEach(async () => {
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it.skipIf(!valkeyAvailable)("S6.3: distributed lock should prevent double-spending with Valkey", async () => {
    const senderId = generateTestId("race-sender-lock");
    const receiverId = generateTestId("race-receiver-lock");
    const amount = 100;
    const numberOfTransfers = 5;

    // Setup: sender with exactly numberOfTransfers * amount
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "RaceSender",
      pocket: amount * numberOfTransfers,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "RaceReceiver",
      pocket: 0,
    });

    // Act: send truly concurrent transfer requests (all at once)
    const promises = Array.from({ length: numberOfTransfers }, () =>
      app.fetch(
        new Request("/api/v1/economy/transfer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY_VALID,
          },
          body: JSON.stringify({
            fromUserId: senderId,
            toUserId: receiverId,
            guildId: TEST_GUILD.ID,
            amount,
            fromUsername: "RaceSender",
            toUsername: "RaceReceiver",
          }),
        })
      )
    );

    const results = await Promise.allSettled(promises);

    // Get final balances
    const finalSender = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
    });
    const finalReceiver = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
    });

    // With distributed lock: at most all transfers succeed (lock serializes)
    // Sender should have 0, receiver should have all the money
    expect(finalSender?.pocket ?? 0).toBe(0);
    expect(finalReceiver?.pocket ?? 0).toBe(amount * numberOfTransfers);

    console.log(`Final sender: ${finalSender?.pocket}, Final receiver: ${finalReceiver?.pocket}`);
  });

  it.skipIf(!valkeyAvailable)("S6.4: distributed lock should serialize deposit operations", async () => {
    const userId = generateTestId("race-user-lock");
    const initialPocket = 500;
    const amount = 100;
    const numberOfDeposits = 5;

    // Setup: user with pocket
    await createTestUserEconomy(TEST_GUILD.ID, userId, {
      username: "RaceUser",
      pocket: initialPocket,
    });
    await createTestBank(userId, { username: "RaceUser", bank: 0 });

    // Act: send truly concurrent deposits
    const promises = Array.from({ length: numberOfDeposits }, () =>
      app.fetch(
        new Request("/api/v1/economy/deposit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY_VALID,
          },
          body: JSON.stringify({
            userId,
            guildId: TEST_GUILD.ID,
            username: "RaceUser",
            amount,
          }),
        })
      )
    );

    const results = await Promise.allSettled(promises);

    // Get final balances
    const finalUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    const finalBank = await prisma.globalBank.findUnique({
      where: { userId },
    });

    // All deposits should succeed (lock serializes)
    expect(finalUser?.pocket ?? 0).toBe(0); // All deposited
    expect(finalBank?.bank ?? 0).toBe(initialPocket + (amount * numberOfDeposits));

    console.log(`Final pocket: ${finalUser?.pocket}, Final bank: ${finalBank?.bank}`);
  });
});