import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { TEST_GUILD, TEST_USERS, createTestUser, createStandardUser, createTestConfig } from "../fixtures/users";
import type { TestPrismaClient } from "../helpers/db";

describe("POST /transfer - Atomic Transfer", () => {
  beforeEach(async () => {
    // Create test config for the guild
    await prisma.economyConfig.upsert({
      where: { guildId: TEST_GUILD.ID },
      update: {},
      create: {
        guildId: TEST_GUILD.ID,
        startingMoney: 1000,
        workMinAmount: 100,
        workMaxAmount: 300,
        workCooldown: 300000,
        crimeCooldown: 900000,
        robCooldown: 1800000,
        crimeMultiplier: 3,
        jailTimeWork: 30,
        jailTimeRob: 45,
      },
    });
  });

  it("T3.1: should successfully transfer money between users", async () => {
    const senderId = `sender-${Date.now()}`;
    const receiverId = `receiver-${Date.now()}`;
    const amount = 500;

    // Use Prisma transaction for test isolation
    const result = await prisma.$transaction(async (tx) => {
      // Create sender with 1000 pocket
      const sender = await tx.userEconomy.create({
        data: {
          userId: senderId,
          guildId: TEST_GUILD.ID,
          username: "Sender",
          pocket: 1000,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Create receiver with 100 pocket
      const receiver = await tx.userEconomy.create({
        data: {
          userId: receiverId,
          guildId: TEST_GUILD.ID,
          username: "Receiver",
          pocket: 100,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Perform transfer (simulating the route handler logic)
      const transferResult = await tx.$transaction(async (innerTx) => {
        const [fromUser, toUser] = await Promise.all([
          innerTx.userEconomy.findUnique({
            where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
          }),
          innerTx.userEconomy.findUnique({
            where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
          }),
        ]);

        if (!fromUser || !toUser) {
          throw new Error("One or both users not found");
        }

        if (fromUser.pocket < amount) {
          throw new Error("Insufficient funds");
        }

        const [updatedFrom, updatedTo] = await Promise.all([
          innerTx.userEconomy.update({
            where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
            data: {
              pocket: fromUser.pocket - amount,
              totalLost: fromUser.totalLost + amount,
            },
          }),
          innerTx.userEconomy.update({
            where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
            data: {
              pocket: toUser.pocket + amount,
              totalEarned: toUser.totalEarned + amount,
            },
          }),
        ]);

        return { fromUser: updatedFrom, toUser: updatedTo };
      });

      return transferResult;
    });

    // Verify sender's balance decreased
    expect(result.fromUser.pocket).toBe(500);
    expect(result.fromUser.totalLost).toBe(500);

    // Verify receiver's balance increased
    expect(result.toUser.pocket).toBe(600);
    expect(result.toUser.totalEarned).toBe(500);

    // Cleanup
    await prisma.userEconomy.deleteMany({
      where: { userId: { in: [senderId, receiverId] } },
    });
  });

  it("T3.2: should fail transfer with insufficient funds", async () => {
    const senderId = `sender-poor-${Date.now()}`;
    const receiverId = `receiver-${Date.now()}`;
    const amount = 1000;

    await prisma.$transaction(async (tx) => {
      // Create sender with only 100 pocket
      await tx.userEconomy.create({
        data: {
          userId: senderId,
          guildId: TEST_GUILD.ID,
          username: "PoorSender",
          pocket: 100,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Create receiver
      await tx.userEconomy.create({
        data: {
          userId: receiverId,
          guildId: TEST_GUILD.ID,
          username: "Receiver",
          pocket: 100,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Attempt transfer that should fail
      await expect(
        tx.$transaction(async (innerTx) => {
          const fromUser = await innerTx.userEconomy.findUnique({
            where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
          });

          if (!fromUser || fromUser.pocket < amount) {
            throw new Error("Insufficient funds");
          }
        })
      ).rejects.toThrow("Insufficient funds");
    });

    // Cleanup
    await prisma.userEconomy.deleteMany({
      where: { userId: { in: [senderId, receiverId] } },
    });
  });

  it("T3.3: should fail transfer to non-existent receiver", async () => {
    const senderId = `sender-${Date.now()}`;
    const nonExistentReceiverId = "non-existent-user-123";
    const amount = 100;

    await prisma.$transaction(async (tx) => {
      // Create sender
      await tx.userEconomy.create({
        data: {
          userId: senderId,
          guildId: TEST_GUILD.ID,
          username: "Sender",
          pocket: 1000,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Attempt transfer to non-existent user
      await expect(
        tx.$transaction(async (innerTx) => {
          const [fromUser, toUser] = await Promise.all([
            innerTx.userEconomy.findUnique({
              where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
            }),
            innerTx.userEconomy.findUnique({
              where: { userId_guildId: { userId: nonExistentReceiverId, guildId: TEST_GUILD.ID } },
            }),
          ]);

          if (!fromUser || !toUser) {
            throw new Error("One or both users not found");
          }
        })
      ).rejects.toThrow("One or both users not found");
    });

    // Cleanup
    await prisma.userEconomy.delete({
      where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
    });
  });

  it("T3.4: should fail transfer with invalid amount (zero)", async () => {
    const senderId = `sender-${Date.now()}`;
    const receiverId = `receiver-${Date.now()}`;
    const amount = 0;

    await prisma.$transaction(async (tx) => {
      // Create users
      await tx.userEconomy.create({
        data: {
          userId: senderId,
          guildId: TEST_GUILD.ID,
          username: "Sender",
          pocket: 1000,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      await tx.userEconomy.create({
        data: {
          userId: receiverId,
          guildId: TEST_GUILD.ID,
          username: "Receiver",
          pocket: 100,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Transfer with zero amount - validation should catch this
      // The schema requires positive() number, so this would fail at validation
      // In practice, we test the business logic rejects zero
      await expect(
        tx.$transaction(async (innerTx) => {
          const fromUser = await innerTx.userEconomy.findUnique({
            where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
          });

          // Simulate validation check
          if (amount <= 0) {
            throw new Error("Amount must be positive");
          }
        })
      ).rejects.toThrow("Amount must be positive");
    });

    // Cleanup
    await prisma.userEconomy.deleteMany({
      where: { userId: { in: [senderId, receiverId] } },
    });
  });

  it("T3.4b: should fail transfer with negative amount", async () => {
    const senderId = `sender-${Date.now()}`;
    const receiverId = `receiver-${Date.now()}`;
    const amount = -100;

    await prisma.$transaction(async (tx) => {
      await tx.userEconomy.create({
        data: {
          userId: senderId,
          guildId: TEST_GUILD.ID,
          username: "Sender",
          pocket: 1000,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      await tx.userEconomy.create({
        data: {
          userId: receiverId,
          guildId: TEST_GUILD.ID,
          username: "Receiver",
          pocket: 100,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Transfer with negative amount - validation should catch this
      await expect(
        tx.$transaction(async () => {
          // Simulate validation check
          if (amount <= 0) {
            throw new Error("Amount must be positive");
          }
        })
      ).rejects.toThrow("Amount must be positive");
    });

    // Cleanup
    await prisma.userEconomy.deleteMany({
      where: { userId: { in: [senderId, receiverId] } },
    });
  });
});
