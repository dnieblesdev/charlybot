import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { createTestUserEconomy, createTestEconomyConfig, cleanupEconomyData, API_KEY, TEST_GUILD, generateTestId } from "./setup";
import app from "../../src/index";

describe("POST /api/v1/economy/transfer - Atomic Transfer", () => {
  const API_KEY_VALID = API_KEY;

  beforeEach(async () => {
    // Create test config for the guild
    await createTestEconomyConfig(TEST_GUILD.ID);
  });

  afterEach(async () => {
    await cleanupEconomyData([TEST_GUILD.ID], []);
  });

  it("S1.5: should successfully transfer money between users", async () => {
    const senderId = generateTestId("sender");
    const receiverId = generateTestId("receiver");
    const amount = 500;

    // Setup: create sender with 1000 pocket, receiver with 100 pocket
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "Sender",
      pocket: 1000,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: transfer via HTTP
    const res = await app.fetch(
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
          fromUsername: "Sender",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; fromUser?: { pocket: number; totalLost: number }; toUser?: { pocket: number; totalEarned: number } };
    expect(body.success).toBe(true);
    expect(body.fromUser?.pocket).toBe(500); // 1000 - 500
    expect(body.fromUser?.totalLost).toBe(500);
    expect(body.toUser?.pocket).toBe(600); // 100 + 500
    expect(body.toUser?.totalEarned).toBe(500);

    // Verify final state in DB
    const updatedSender = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
    });
    const updatedReceiver = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
    });
    expect(updatedSender?.pocket).toBe(500);
    expect(updatedSender?.totalLost).toBe(500);
    expect(updatedReceiver?.pocket).toBe(600);
    expect(updatedReceiver?.totalEarned).toBe(500);
  });

  it("S1.7: should fail transfer with insufficient funds", async () => {
    const senderId = generateTestId("sender-poor");
    const receiverId = generateTestId("receiver");
    const amount = 1000;

    // Setup: create sender with only 100 pocket
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "PoorSender",
      pocket: 100,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: attempt transfer via HTTP
    const res = await app.fetch(
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
          fromUsername: "PoorSender",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert: should return 400 error
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("Insufficient funds");
  });

  it("S1.6: should fail transfer when receiver does not exist", async () => {
    const senderId = generateTestId("sender-no-receiver");
    const nonExistentReceiverId = generateTestId("non-existent-receiver");
    const amount = 100;

    // Setup: create sender only, no receiver
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "Sender",
      pocket: 1000,
    });

    // Act: transfer to non-existent receiver via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          fromUserId: senderId,
          toUserId: nonExistentReceiverId,
          guildId: TEST_GUILD.ID,
          amount,
          fromUsername: "Sender",
          toUsername: "NonExistent",
        }),
      })
    );

    // Assert: should return 400 error (route throws "One or both users not found")
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("One or both users not found");
  });

  it("S1.8: should fail transfer with zero amount (Zod validation)", async () => {
    const senderId = generateTestId("sender-zero");
    const receiverId = generateTestId("receiver-zero");

    // Setup: create both users
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "Sender",
      pocket: 1000,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: transfer with amount = 0
    const res = await app.fetch(
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
          amount: 0,
          fromUsername: "Sender",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert: Zod requires positive number, so 0 should fail validation
    expect(res.status).toBe(400);
  });

  it("S1.8b: should fail transfer with negative amount (Zod validation)", async () => {
    const senderId = generateTestId("sender-negative");
    const receiverId = generateTestId("receiver-negative");

    // Setup: create both users
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "Sender",
      pocket: 1000,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: transfer with negative amount
    const res = await app.fetch(
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
          amount: -100,
          fromUsername: "Sender",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert: should return 400 due to Zod validation
    expect(res.status).toBe(400);
  });

  it("S1.11: should return 401 when no API key is provided", async () => {
    const senderId = generateTestId("sender-no-auth");
    const receiverId = generateTestId("receiver-no-auth");

    // Setup: create both users
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "Sender",
      pocket: 1000,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: transfer WITHOUT X-API-Key header
    const res = await app.fetch(
      new Request("/api/v1/economy/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // No X-API-Key header
        },
        body: JSON.stringify({
          fromUserId: senderId,
          toUserId: receiverId,
          guildId: TEST_GUILD.ID,
          amount: 100,
          fromUsername: "Sender",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert: should return 401
    expect(res.status).toBe(401);
  });

  it("S7.3: should return 401 when invalid API key is provided", async () => {
    const senderId = generateTestId("sender-invalid-key");
    const receiverId = generateTestId("receiver-invalid-key");

    // Setup: create both users
    await createTestUserEconomy(TEST_GUILD.ID, senderId, {
      username: "Sender",
      pocket: 1000,
    });
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: transfer with wrong API key
    const res = await app.fetch(
      new Request("/api/v1/economy/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "wrong-api-key",
        },
        body: JSON.stringify({
          fromUserId: senderId,
          toUserId: receiverId,
          guildId: TEST_GUILD.ID,
          amount: 100,
          fromUsername: "Sender",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert: should return 401
    expect(res.status).toBe(401);
  });

  it("S1.6 variant: should fail transfer when sender does not exist", async () => {
    const nonExistentSenderId = generateTestId("non-existent-sender");
    const receiverId = generateTestId("receiver-no-sender");
    const amount = 100;

    // Setup: create receiver only, no sender
    await createTestUserEconomy(TEST_GUILD.ID, receiverId, {
      username: "Receiver",
      pocket: 100,
    });

    // Act: transfer from non-existent sender via HTTP
    const res = await app.fetch(
      new Request("/api/v1/economy/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY_VALID,
        },
        body: JSON.stringify({
          fromUserId: nonExistentSenderId,
          toUserId: receiverId,
          guildId: TEST_GUILD.ID,
          amount,
          fromUsername: "NonExistent",
          toUsername: "Receiver",
        }),
      })
    );

    // Assert: should return 400 error
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("One or both users not found");
  });
});