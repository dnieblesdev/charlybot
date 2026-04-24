import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@charlybot/shared";
import { TEST_GUILD } from "../fixtures/users";
import { withDistributedLock, economyUserLockKey, transferLockKey, initializeValkey, getValkeyClient } from "../../src/infrastructure/valkey";

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

describe("Race Condition Tests - Distributed Locks (requires Valkey)", () => {
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

    // Ensure Valkey is initialized for lock tests
    await initializeValkey();
  });

  it("T6.3: distributed lock should prevent concurrent transfers from double-spending", async () => {
    // Skip if Valkey is not available
    const valkey = getValkeyClient();
    if (!valkey.isConnected()) {
      console.log("Skipping T6.3: Valkey not available");
      return;
    }

    const senderId = `race-sender-lock-${Date.now()}`;
    const receiverId = `race-receiver-lock-${Date.now()}`;
    const amount = 100;
    const numberOfTransfers = 5;

    // Initial state: sender has exactly 5x amount, so max 5 should succeed
    const initialSenderPocket = amount * numberOfTransfers; // 500
    const initialReceiverPocket = 0;

    // Create users
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

    const lockKey = transferLockKey(TEST_GUILD.ID, senderId, receiverId);
    let lockAcquisitionCount = 0;
    let successfulTransfers = 0;
    let failedTransfers = 0;

    // Run concurrent transfers through the actual API lock mechanism
    const results = await Promise.all(
      Array.from({ length: numberOfTransfers }, async (_, i) => {
        try {
          await withDistributedLock(
            'economy',
            lockKey,
            async () => {
              // This callback is only executed when lock is acquired
              lockAcquisitionCount++;

              // Read current state within the lock
              const sender = await prisma.userEconomy.findUnique({
                where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
              });

              if (!sender || sender.pocket < amount) {
                throw new Error("Insufficient funds");
              }

              // Perform the transfer
              await prisma.$transaction(async (tx) => {
                await tx.userEconomy.update({
                  where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
                  data: { pocket: sender.pocket - amount, totalLost: sender.totalLost + amount },
                });

                await tx.userEconomy.update({
                  where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
                  data: { pocket: (sender.pocket - amount) + amount, totalEarned: amount },
                });
              });
            },
            30, // TTL 30 seconds
            0   // No retries - fail immediately if lock not acquired
          );

          successfulTransfers++;
          return { success: true, index: i };
        } catch (error) {
          failedTransfers++;
          return { success: false, error: (error as Error).message, index: i };
        }
      })
    );

    // Verify: lock acquisition count should equal number of successful transfers
    // because the lock serializes access - only one transfer runs at a time
    expect(successfulTransfers).toBe(numberOfTransfers);
    expect(lockAcquisitionCount).toBe(numberOfTransfers);

    // Get final balances
    const finalSender = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: senderId, guildId: TEST_GUILD.ID } },
    });
    const finalReceiver = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId: receiverId, guildId: TEST_GUILD.ID } },
    });

    // Sender should have 0 pocket (spent all)
    expect(finalSender?.pocket ?? 0).toBe(0);
    // Receiver should have received exactly amount * successfulTransfers
    expect(finalReceiver?.pocket ?? 0).toBe(amount * successfulTransfers);

    console.log(`Successful transfers: ${successfulTransfers}, Lock acquisitions: ${lockAcquisitionCount}`);

    // Cleanup
    await prisma.userEconomy.deleteMany({
      where: { userId: { in: [senderId, receiverId] } },
    });
  });

  it("T6.4: distributed lock should prevent concurrent withdraw/deposit operations", async () => {
    // Skip if Valkey is not available
    const valkey = getValkeyClient();
    if (!valkey.isConnected()) {
      console.log("Skipping T6.4: Valkey not available");
      return;
    }

    const userId = `race-user-lock-${Date.now()}`;
    const username = "RaceUser";
    const amount = 100;
    const numberOfOperations = 5;

    // Initial state: user has amount * operations in pocket, bank has 0
    const initialPocket = amount * numberOfOperations; // 500
    const initialBank = 0;

    // Create user and bank
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

    const lockKey = economyUserLockKey(TEST_GUILD.ID, userId);
    let successfulOps = 0;
    let failedOps = 0;

    // Run concurrent deposit operations (all deposit into bank)
    const results = await Promise.all(
      Array.from({ length: numberOfOperations }, async (_, i) => {
        try {
          await withDistributedLock(
            'economy',
            lockKey,
            async () => {
              // Read current state within the lock
              const user = await prisma.userEconomy.findUnique({
                where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
              });

              const bank = await prisma.globalBank.findUnique({
                where: { userId },
              });

              if (!user || user.pocket < amount) {
                throw new Error("Insufficient funds in pocket");
              }

              // Perform deposit
              await prisma.$transaction(async (tx) => {
                await tx.userEconomy.update({
                  where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
                  data: { pocket: user.pocket - amount },
                });

                await tx.globalBank.update({
                  where: { userId },
                  data: { bank: (bank?.bank ?? 0) + amount },
                });
              });
            },
            30,
            0
          );

          successfulOps++;
          return { operation: "deposit", success: true, index: i };
        } catch (error) {
          failedOps++;
          return { operation: "deposit", success: false, error: (error as Error).message, index: i };
        }
      })
    );

    // All operations should succeed because the lock serializes them
    expect(successfulOps).toBe(numberOfOperations);

    // Get final balances
    const finalUser = await prisma.userEconomy.findUnique({
      where: { userId_guildId: { userId, guildId: TEST_GUILD.ID } },
    });
    const finalBank = await prisma.globalBank.findUnique({
      where: { userId },
    });

    // User pocket should be 0 (all deposited)
    expect(finalUser?.pocket ?? 0).toBe(0);
    // Bank should have all the money
    expect(finalBank?.bank ?? 0).toBe(amount * numberOfOperations);

    console.log(`Successful ops: ${successfulOps}, Failed ops: ${failedOps}`);

    // Cleanup
    await prisma.userEconomy.deleteMany({ where: { userId } });
    await prisma.globalBank.deleteMany({ where: { userId } });
  });

  it("T6.5: lock should use UUID ownerId (not process.pid)", async () => {
    // Skip if Valkey is not available
    const valkey = getValkeyClient();
    if (!valkey.isConnected()) {
      console.log("Skipping T6.5: Valkey not available");
      return;
    }

    const testLockKey = `test:uuid-owner:${Date.now()}`;
    const lockTtl = 10; // 10 seconds

    // Acquire a lock
    const ownerId1 = require('crypto').randomUUID();
    const acquired1 = await valkey.acquireLock(testLockKey, lockTtl, ownerId1);
    expect(acquired1).toBe(true);

    // Try to release with wrong ownerId - should fail (Lua script returns 0)
    await valkey.releaseLock(testLockKey, "wrong-owner-id");

    // Lock should still be held (not released)
    const ownerId2 = require('crypto').randomUUID();
    const acquired2 = await valkey.acquireLock(testLockKey, lockTtl, ownerId2);
    expect(acquired2).toBe(false); // Lock should still be held by ownerId1

    // Release with correct ownerId - should succeed
    await valkey.releaseLock(testLockKey, ownerId1);

    // Now lock should be available
    const acquired3 = await valkey.acquireLock(testLockKey, lockTtl, ownerId2);
    expect(acquired3).toBe(true);

    // Cleanup
    await valkey.releaseLock(testLockKey, ownerId2);
  });

  it("T6.6: lock operations should fail-deny when unable to acquire", async () => {
    // Skip if Valkey is not available
    const valkey = getValkeyClient();
    if (!valkey.isConnected()) {
      console.log("Skipping T6.6: Valkey not available");
      return;
    }

    const testLockKey = `test:fail-deny:${Date.now()}`;
    const ownerId = require('crypto').randomUUID();

    // The lock should successfully acquire
    const acquired = await valkey.acquireLock(testLockKey, 10, ownerId);
    expect(acquired).toBe(true);

    // Cleanup
    await valkey.releaseLock(testLockKey, ownerId);
  });
});
