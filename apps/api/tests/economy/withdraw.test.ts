import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { TEST_GUILD } from "../fixtures/users";

describe("POST /withdraw - Atomic Withdraw", () => {
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

  it("T5.1: should successfully withdraw money from global bank", async () => {
    const userId = `withdrawer-${Date.now()}`;
    const username = "Withdrawer";
    const withdrawAmount = 300;

    const result = await prisma.$transaction(async (tx) => {
      // Create user with small pocket
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

      // Create bank with money
      await tx.globalBank.create({
        data: {
          userId,
          username,
          bank: 1000,
        },
      });

      // Perform withdraw (simulating the route handler logic)
      const withdrawResult = await tx.$transaction(async (innerTx) => {
        const bank = await innerTx.globalBank.findUnique({
          where: { userId },
        });

        if (!bank || bank.bank < withdrawAmount) {
          throw new Error("Insufficient funds in bank");
        }

        const user = await innerTx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
        });

        const [updatedBank, updatedUser] = await Promise.all([
          innerTx.globalBank.update({
            where: { userId },
            data: { bank: bank.bank - withdrawAmount },
          }),
          innerTx.userEconomy.update({
            where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
            data: { pocket: (user?.pocket ?? 0) + withdrawAmount },
          }),
        ]);

        return { bank: updatedBank, user: updatedUser };
      });

      return withdrawResult;
    });

    // Verify bank's balance decreased
    expect(result.bank.bank).toBe(700);

    // Verify user's pocket increased
    expect(result.user.pocket).toBe(400);

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });

  it("T5.2: should fail withdraw with insufficient funds in bank", async () => {
    const userId = `poor-withdrawer-${Date.now()}`;
    const username = "PoorWithdrawer";
    const withdrawAmount = 500;

    await prisma.$transaction(async (tx) => {
      // Create user
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

      // Create bank with only 100
      await tx.globalBank.create({
        data: {
          userId,
          username,
          bank: 100,
        },
      });

      // Attempt withdraw that should fail
      await expect(
        tx.$transaction(async (innerTx) => {
          const bank = await innerTx.globalBank.findUnique({
            where: { userId },
          });

          if (!bank || bank.bank < withdrawAmount) {
            throw new Error("Insufficient funds in bank");
          }
        })
      ).rejects.toThrow("Insufficient funds in bank");
    });

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });

  it("T5.3: should create new user economy and withdraw to them", async () => {
    const userId = `new-user-${Date.now()}`;
    const username = "NewUser";
    const withdrawAmount = 500;

    const result = await prisma.$transaction(async (tx) => {
      // Create bank with money (no user economy exists yet)
      await tx.globalBank.create({
        data: {
          userId,
          username,
          bank: 1000,
        },
      });

      // Perform withdraw (simulating the route handler logic)
      const withdrawResult = await tx.$transaction(async (innerTx) => {
        const bank = await innerTx.globalBank.findUnique({
          where: { userId },
        });

        if (!bank || bank.bank < withdrawAmount) {
          throw new Error("Insufficient funds in bank");
        }

        // Get or create user economy
        let user = await innerTx.userEconomy.findUnique({
          where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
        });

        if (!user) {
          // Get starting money from config
          const config = await innerTx.economyConfig.findUnique({
            where: { guildId: TEST_GUILD.ID },
          });
          const startingMoney = config?.startingMoney ?? 1000;

          user = await innerTx.userEconomy.create({
            data: {
              userId,
              guildId: TEST_GUILD.ID,
              username,
              pocket: startingMoney,
              totalEarned: 0,
              totalLost: 0,
              inJail: false,
            },
          });
        }

        const [updatedBank, updatedUser] = await Promise.all([
          innerTx.globalBank.update({
            where: { userId },
            data: { bank: bank.bank - withdrawAmount },
          }),
          innerTx.userEconomy.update({
            where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
            data: { pocket: user.pocket + withdrawAmount },
          }),
        ]);

        return { bank: updatedBank, user: updatedUser };
      });

      return withdrawResult;
    });

    // Verify bank's balance decreased
    expect(result.bank.bank).toBe(500);

    // Verify user was created with starting money + withdrawn amount
    expect(result.user.pocket).toBe(1500); // 1000 starting + 500 withdrawn

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });
});
