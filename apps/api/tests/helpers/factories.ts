import { prisma } from "@charlybot/shared";
import type { TestPrismaClient } from "./db";

/**
 * Test factory helpers for creating test data across all API domains.
 * Uses Prisma transactions for test isolation.
 */

const TEST_GUILD_ID = "test-guild-api";
const TEST_GUILD_NAME = "Test Guild API";

/**
 * Generate a unique test ID with timestamp and random suffix.
 */
export function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Guild Factories ============

export async function createTestGuild(tx: TestPrismaClient, guildId: string = TEST_GUILD_ID) {
  return tx.guild.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      name: TEST_GUILD_NAME,
    },
  });
}

export async function createTestGuildConfig(
  tx: TestPrismaClient,
  guildId: string = TEST_GUILD_ID,
  data: Partial<{
    name: string;
    targetChannelId: string;
    voiceLogChannelId: string;
    welcomeChannelId: string;
    welcomeMessage: string;
    leaveLogChannelId: string;
    verificationChannelId: string;
    verificationReviewChannelId: string;
    verifiedRoleId: string;
    messageLogChannelId: string;
  }> = {}
) {
  return tx.guildConfig.upsert({
    where: { guildId },
    update: data,
    create: {
      guildId,
      name: data.name ?? null,
      targetChannelId: data.targetChannelId ?? null,
      voiceLogChannelId: data.voiceLogChannelId ?? null,
      welcomeChannelId: data.welcomeChannelId ?? null,
      welcomeMessage: data.welcomeMessage ?? null,
      leaveLogChannelId: data.leaveLogChannelId ?? null,
      verificationChannelId: data.verificationChannelId ?? null,
      verificationReviewChannelId: data.verificationReviewChannelId ?? null,
      verifiedRoleId: data.verifiedRoleId ?? null,
      messageLogChannelId: data.messageLogChannelId ?? null,
    },
  });
}

// ============ Verification Factories ============

export async function createTestVerification(
  tx: TestPrismaClient,
  data: {
    id?: string;
    guildId: string;
    userId: string;
    inGameName: string;
    screenshotUrl: string;
    status?: "pending" | "approved" | "rejected";
  }
) {
  return tx.verificationRequest.create({
    data: {
      id: data.id ?? generateTestId("verif"),
      guildId: data.guildId,
      userId: data.userId,
      inGameName: data.inGameName,
      screenshotUrl: data.screenshotUrl,
      status: data.status ?? "pending",
      requestedAt: new Date(),
    },
  });
}

// ============ Music Factories ============

export async function createTestMusicQueue(tx: TestPrismaClient, guildId: string = TEST_GUILD_ID) {
  return tx.musicQueue.upsert({
    where: { guildId },
    update: {},
    create: {
      guildId,
      volume: 50,
      loopMode: "none",
      isPlaying: false,
      isPaused: false,
    },
  });
}

export async function createTestMusicQueueItem(
  tx: TestPrismaClient,
  queueId: string,
  data: {
    title: string;
    url: string;
    duration: number;
    position: number;
    requesterId: string;
    requesterName: string;
  }
) {
  return tx.musicQueueItem.create({
    data: {
      queueId,
      title: data.title,
      url: data.url,
      duration: data.duration,
      position: data.position,
      requesterId: data.requesterId,
      requesterName: data.requesterName,
    },
  });
}

export async function createTestMusicConfig(
  tx: TestPrismaClient,
  guildId: string = TEST_GUILD_ID,
  data: Partial<{
    defaultVolume: number;
    autoCleanup: boolean;
    maxQueueSize: number;
  }> = {}
) {
  return tx.guildMusicConfig.upsert({
    where: { guildId },
    update: data,
    create: {
      guildId,
      defaultVolume: data.defaultVolume ?? 50,
      autoCleanup: data.autoCleanup ?? true,
      maxQueueSize: data.maxQueueSize ?? 500,
    },
  });
}

// ============ Classes Factories ============

export async function createTestTipoClase(
  tx: TestPrismaClient,
  guildId: string = TEST_GUILD_ID,
  rolId: string,
  nombre: string
) {
  return tx.tipoClase.upsert({
    where: { guildId_rolId: { guildId, rolId } },
    update: { nombre },
    create: { guildId, rolId, nombre },
  });
}

export async function createTestClass(
  tx: TestPrismaClient,
  data: {
    guildId: string;
    rolId: string;
    name: string;
    tipoId: string;
  }
) {
  return tx.classes.upsert({
    where: { guildId_rolId: { guildId: data.guildId, rolId: data.rolId } },
    update: { name: data.name, tipoId: data.tipoId },
    create: {
      guildId: data.guildId,
      rolId: data.rolId,
      name: data.name,
      tipoId: data.tipoId,
    },
  });
}

export async function createTestSubclass(
  tx: TestPrismaClient,
  data: {
    guildId: string;
    claseId: string;
    name: string;
    rolId: string;
  }
) {
  return tx.subclass.create({
    data: {
      guildId: data.guildId,
      claseId: data.claseId,
      name: data.name,
      rolId: data.rolId,
    },
  });
}

// ============ Autorole Factories ============

export async function createTestAutorole(
  tx: TestPrismaClient,
  data: {
    guildId: string;
    messageId: string;
    channelId: string;
    createdBy: string;
    mode: "multiple" | "unique";
    mappings?: Array<{
      roleId: string;
      type: "reaction" | "button";
      order: number;
      emoji?: string;
      buttonLabel?: string;
      buttonStyle?: string;
    }>;
  }
) {
  return tx.autoRole.create({
    data: {
      guildId: data.guildId,
      messageId: data.messageId,
      channelId: data.channelId,
      createdBy: data.createdBy,
      mode: data.mode,
      mappings: data.mappings
        ? {
            create: data.mappings.map((m, idx) => ({
              roleId: m.roleId,
              type: m.type,
              order: m.order,
              emoji: m.emoji ?? null,
              buttonLabel: m.buttonLabel ?? null,
              buttonStyle: m.buttonStyle ?? null,
            })),
          }
        : undefined,
    },
    include: { mappings: true },
  });
}

// ============ XP Factories ============

export async function createTestXPConfig(
  tx: TestPrismaClient,
  guildId: string = TEST_GUILD_ID,
  overrides?: Partial<{
    xpPerMessage: number;
    enabled: boolean;
    levelUpChannelId: string;
    levelUpMessage: string;
  }>
) {
  return tx.xPConfig.upsert({
    where: { guildId },
    update: overrides ?? {},
    create: {
      guildId,
      xpPerMessage: overrides?.xpPerMessage ?? 1,
      enabled: overrides?.enabled ?? true,
      levelUpChannelId: overrides?.levelUpChannelId ?? null,
      levelUpMessage: overrides?.levelUpMessage ?? null,
    },
  });
}

export async function createTestLevelRole(
  tx: TestPrismaClient,
  guildId: string = TEST_GUILD_ID,
  level: number = 10,
  roleId: string = "role-123",
  overrides?: Partial<{ level: number; roleId: string }>
) {
  return tx.levelRole.create({
    data: {
      guildId,
      level: overrides?.level ?? level,
      roleId: overrides?.roleId ?? roleId,
    },
  });
}

export async function createTestUserXP(
  tx: TestPrismaClient,
  userId: string = "user-xp-test",
  guildId: string = TEST_GUILD_ID,
  overrides?: Partial<{
    xp: number;
    nivel: number;
    username: string;
    lastMessageAt: Date;
  }>
) {
  return tx.userXP.create({
    data: {
      userId,
      guildId,
      xp: overrides?.xp ?? 0,
      nivel: overrides?.nivel ?? 0,
      username: overrides?.username ?? "TestUser",
      lastMessageAt: overrides?.lastMessageAt ?? new Date(),
    },
  });
}

export async function cleanupXPData(tx: TestPrismaClient, guildId: string = TEST_GUILD_ID) {
  try {
    await tx.userXP.deleteMany({ where: { guildId } });
  } catch (e) { /* ignore */ }

  try {
    await tx.levelRole.deleteMany({ where: { guildId } });
  } catch (e) { /* ignore */ }

  try {
    await tx.xPConfig.deleteMany({ where: { guildId } });
  } catch (e) { /* ignore */ }
}

// ============ Cleanup Helpers ============

export async function cleanupTestGuild(tx: TestPrismaClient, guildId: string = TEST_GUILD_ID) {
  // Delete in correct order due to foreign keys
  // Note: Using raw queries for safety since some tables may have composite keys
  
  try {
    await tx.musicQueueItem.deleteMany({
      where: { queue: { guildId } },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.musicQueue.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.guildMusicConfig.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.verificationRequest.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.classes.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.tipoClase.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.autoRole.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.guildConfig.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
  
  try {
    await tx.guild.deleteMany({
      where: { guildId },
    });
  } catch (e) { /* ignore */ }
}

export { TEST_GUILD_ID, TEST_GUILD_NAME };
