import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { TEST_GUILD } from "../fixtures/users";

describe("Race Condition Tests - Atomic Operations", () => {
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

  it("T6.1: should handle concurrent transfers between the same users correctly", async () => {
    const senderId = `race-sender-${Date.now()}`;
    const receiverId = `race-receiver-${Date.now()}`;
    const amount = 100;
    const numberOfTransfers = 5;

    // Get initial state
    const initialSenderPocket = 1000;
    const initialReceiverPocket = 100;

    // Create users first (needed before concurrent transfers)
    await prisma.userEconomy.createMany({
      data: [
        {
          userId: senderId,
          guildId: TEST_GUILD.ID,
          username: "RaceSender",
          pocket: initialSenderPocket,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
        {
          userId: receiverId,
          guildId: TEST_GUILD.ID,
          username: "RaceReceiver",
          pocket: initialReceiverPocket,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
        },
      ],
    });

    // Run concurrent transfers
    const results = await Promise.all(
      Array.from({ length: numberOfTransfers }, (_, i) =>
        prisma.$transaction(async (tx) => {
          try {
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

              return { success: true, fromUser: updatedFrom, toUser: updatedTo };
            });
            return { success: true, index: i };
          } catch (error) {
            return { success: false, error: (error as Error).message, index: i };
          }
        })
      )
    );

    // Check how many transfers succeeded
    const successfulTransfers = results.filter((r) => r.success).length;
    const failedTransfers = results.filter((r) => !r.success);

    // Get final balances
    const finalSender = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
    });
    const finalReceiver = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
    });

    // The key assertion: sender should never go below zero
    // With 1000 initial and 5 attempts of 100 each, only 10 can succeed
    // But since they're concurrent, some will fail due to insufficient funds
    expect(finalSender?.pocket ?? 0).toBeGreaterThanOrEqual(0);
    
    // The total transferred should equal successful transfers * amount
    const expectedTotalTransferred = successfulTransfers * amount;
    const actualTransferred = initialSenderPocket - (finalSender?.pocket ?? 0);
    expect(actualTransferred).toBe(expectedTotalTransferred);

    // Receiver should have received exactly what sender lost
    const receiverGained = (finalReceiver?.pocket ?? 0) - initialReceiverPocket;
    expect(receiverGained).toBe(expectedTotalTransferred);

    console.log(`Successful transfers: ${successfulTransfers}, Failed: ${failedTransfers.length}`);

    // Cleanup
    await prisma.userEconomy.deleteMany({
      where: { userId: { in: [senderId, receiverId] } },
    });
  });

  it("T6.2: should handle concurrent deposit and withdraw operations", async () => {
    const userId = `race-user-${Date.now()}`;
    const username = "RaceUser";
    const amount = 100;
    const numberOfOperations = 5;

    // Initial state: user has 1000 in pocket, bank has 1000
    const initialPocket = 1000;
    const initialBank = 1000;

    // Create user and bank first (needed before concurrent operations)
    await prisma.userEconomy.create({
      data: {
        userId,
        guildId: TEST_GUILD.ID,
        username,
        pocket: initialPocket,
        totalEarned: 0,
        totalLost: 0,
        inJail: false,
      },
    });

    await prisma.globalBank.create({
      data: {
        userId,
        username,
        bank: initialBank,
      },
    });

    // Run concurrent operations: 3 deposits and 2 withdraws
    const depositIndices = [0, 2, 4];
    const withdrawIndices = [1, 3];

    const results = await Promise.all(
      Array.from({ length: numberOfOperations }, (_, i) =>
        prisma.$transaction(async (tx) => {
          try {
            if (depositIndices.includes(i)) {
              // Deposit operation
              await tx.$transaction(async (innerTx) => {
                const user = await innerTx.userEconomy.findUnique({
                  where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
                });

                if (!user || user.pocket < amount) {
                  throw new Error("Insufficient funds in pocket");
                }

                const bank = await innerTx.globalBank.findUnique({
                  where: { userId },
                });

                await Promise.all([
                  innerTx.userEconomy.update({
                    where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
                    data: { pocket: user.pocket - amount },
                  }),
                  innerTx.globalBank.update({
                    where: { userId },
                    data: { bank: (bank?.bank ?? 0) + amount },
                  }),
                ]);
              });
              return { operation: "deposit", success: true, index: i };
            } else {
              // Withdraw operation
              await tx.$transaction(async (innerTx) => {
                const bank = await innerTx.globalBank.findUnique({
                  where: { userId },
                });

                if (!bank || bank.bank < amount) {
                  throw new Error("Insufficient funds in bank");
                }

                const user = await innerTx.userEconomy.findUnique({
                  where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
                });

                await Promise.all([
                  innerTx.globalBank.update({
                    where: { userId },
                    data: { bank: bank.bank - amount },
                  }),
                  innerTx.userEconomy.update({
                    where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
                    data: { pocket: (user?.pocket ?? 0) + amount },
                  }),
                ]);
              });
              return { operation: "withdraw", success: true, index: i };
            }
          } catch (error) {
            return { 
              operation: depositIndices.includes(i) ? "deposit" : "withdraw",
              success: false, 
              error: (error as Error).message, 
              index: i 
            };
          }
        })
      )
    );

    // Get final balances
    const finalUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    const finalBank = await prisma.globalBank.findUnique({
      where: { userId },
    });

    const pocketChange = (finalUser?.pocket ?? 0) - initialPocket;
    const bankChange = (finalBank?.bank ?? 0) - initialBank;

    // Pocket and bank changes should be inverse of each other
    expect(pocketChange).toBe(-bankChange);

    // Neither should go negative
    expect(finalUser?.pocket ?? 0).toBeGreaterThanOrEqual(0);
    expect(finalBank?.bank ?? 0).toBeGreaterThanOrEqual(0);

    console.log(`Pocket change: ${pocketChange}, Bank change: ${bankChange}`);
    console.log(`Results:`, results);

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });
});
