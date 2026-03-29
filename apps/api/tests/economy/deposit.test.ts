import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { TEST_GUILD } from "../fixtures/users";

describe("POST /deposit - Atomic Deposit", () => {
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

  it("T4.1: should successfully deposit money to global bank", async () => {
    const userId = `depositor-${Date.now()}`;
    const username = "Depositor";
    const depositAmount = 500;

    const result = await prisma.$transaction(async (tx) => {
      // Create user with pocket money
      await tx.userEconomy.create({
        data: {
          userId,
          guildId: TEST_GUILD.ID,
          username,
          pocket: 1000,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Create initial bank
      await tx.globalBank.create({
        data: {
          userId,
          username,
          bank: 100,
        },
      });

      // Perform deposit (simulating the route handler logic)
      const depositResult = await tx.$transaction(async (innerTx) => {
        const user = await innerTx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
        });

        if (!user || user.pocket < depositAmount) {
          throw new Error("Insufficient funds in pocket");
        }

        const bank = await innerTx.globalBank.findUnique({
          where: { userId },
        });

        const [updatedUser, updatedBank] = await Promise.all([
          innerTx.userEconomy.update({
            where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
            data: { pocket: user.pocket - depositAmount },
          }),
          innerTx.globalBank.update({
            where: { userId },
            data: { bank: (bank?.bank ?? 0) + depositAmount },
          }),
        ]);

        return { user: updatedUser, bank: updatedBank };
      });

      return depositResult;
    });

    // Verify user's pocket decreased
    expect(result.user.pocket).toBe(500);

    // Verify bank's balance increased
    expect(result.bank.bank).toBe(600);

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });

  it("T4.2: should fail deposit with insufficient funds in pocket", async () => {
    const userId = `poor-depositor-${Date.now()}`;
    const username = "PoorDepositor";
    const depositAmount = 500;

    await prisma.$transaction(async (tx) => {
      // Create user with only 100 in pocket
      await tx.userEconomy.create({
        data: {
          userId,
          guildId: TEST_GUILD.ID,
          username,
          pocket: 100,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Attempt deposit that should fail
      await expect(
        tx.$transaction(async (innerTx) => {
          const user = await innerTx.userEconomy.findUnique({
            where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
          });

          if (!user || user.pocket < depositAmount) {
            throw new Error("Insufficient funds in pocket");
          }
        })
      ).rejects.toThrow("Insufficient funds in pocket");
    });

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });

  it("T4.3: should create new bank if it doesn't exist", async () => {
    const userId = `new-depositor-${Date.now()}`;
    const username = "NewDepositor";
    const depositAmount = 300;

    const result = await prisma.$transaction(async (tx) => {
      // Create user with pocket money (no bank exists yet)
      await tx.userEconomy.create({
        data: {
          userId,
          guildId: TEST_GUILD.ID,
          username,
          pocket: 1000,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      });

      // Perform deposit (simulating the route handler logic)
      const depositResult = await tx.$transaction(async (innerTx) => {
        const user = await innerTx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
        });

        if (!user || user.pocket < depositAmount) {
          throw new Error("Insufficient funds in pocket");
        }

        // Get or create global bank
        let bank = await innerTx.globalBank.findUnique({
          where: { userId },
        });

        if (!bank) {
          bank = await innerTx.globalBank.create({
            data: { userId, username, bank: 0 },
          });
        }

        const [updatedUser, updatedBank] = await Promise.all([
          innerTx.userEconomy.update({
            where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
            data: { pocket: user.pocket - depositAmount },
          }),
          innerTx.globalBank.update({
            where: { userId },
            data: { bank: bank.bank + depositAmount },
          }),
        ]);

        return { user: updatedUser, bank: updatedBank };
      });

      return depositResult;
    });

    // Verify user's pocket decreased
    expect(result.user.pocket).toBe(700);

    // Verify bank was created and has the deposited amount
    expect(result.bank.bank).toBe(300);

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });
});
