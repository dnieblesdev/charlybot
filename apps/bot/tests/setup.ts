import { beforeAll, afterAll, afterEach, vi } from "vitest";

/**
 * Global test setup for Vitest.
 * This file runs once before all tests in apps/bot/.
 */

beforeAll(() => {
  vi.setConfig({
    testTimeout: 5000,
    hookTimeout: 5000,
  });
});

afterAll(() => {
  // Cleanup if needed
});

afterEach(() => {
  vi.clearAllMocks();
});

// Mock @charlybot/shared — replace prisma with a stub, pass through everything else.
// This lets tests run without a real database while keeping all other shared exports intact.
vi.mock("@charlybot/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@charlybot/shared")>();

  // Build prisma mock separately so $transaction can reference it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaMock: Record<string, any> = {
    userEconomy: {
      findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), upsert: vi.fn(),
    },
    globalBank: {
      findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      update: vi.fn(), upsert: vi.fn(),
    },
    economyConfig: {
      findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      update: vi.fn(), upsert: vi.fn(),
    },
    leaderboard: {
      findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      update: vi.fn(), upsert: vi.fn(), count: vi.fn(),
    },
    rouletteGame: {
      findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
    },
    rouletteBet: {
      create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(),
    },
    modCase: {
      count: vi.fn(() => Promise.resolve(0)), create: vi.fn(),
      findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(),
    },
    antiSpamConfig: {
      findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(),
    },
    socialLink: {
      findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(),
      update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), count: vi.fn(),
    },
    guild: {
      upsert: vi.fn(), findUnique: vi.fn(),
    },
  };

  prismaMock.$transaction = vi.fn((cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock));

  return {
    ...actual,
    prisma: prismaMock,
  };
});
