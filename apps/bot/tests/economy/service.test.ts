import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IUserEconomy } from "@charlybot/shared";

// =============================================================================
// vi.hoisted() pattern: create mocks BEFORE vi.mock() hoisting
//
// When EconomyService does `import * as EconomyRepo`, the namespace object
// is bound at import time. vi.mock() factory runs AFTER that binding.
// The fix: vi.hoisted() creates mock functions BEFORE hoisting, so vi.mock()
// returns the SAME function references the service will find.
// =============================================================================

const {
  mockGetEconomyUser,
  mockCreateEconomyUser,
  mockUpdateEconomyUser,
  mockGetGlobalBank,
  mockCreateGlobalBank,
  mockUpdateGlobalBank,
  mockGetEconomyConfig,
  mockCreateEconomyConfig,
  mockUpdateEconomyConfig,
  mockGetLeaderboard,
  mockGetLeaderboardEntry,
  mockUpsertLeaderboard,
  mockGetUserPosition,
  mockRemoveFromLeaderboard,
  mockCreateRouletteGame,
  mockGetActiveRouletteGame,
  mockGetRouletteGame,
  mockUpdateRouletteGame,
  mockDeleteRouletteGame,
  mockPlaceRouletteBet,
  mockUpdateRouletteBet,
  mockAtomicTransfer,
  mockAtomicDeposit,
  mockAtomicWithdraw,
  mockAtomicAddPocket,
  mockAtomicSubtractPocket,
  mockAtomicClaimCooldown,
  mockAtomicPlaceBet,
  mockAtomicProcessRouletteResults,
  mockAtomicCancelRouletteGame,
} = vi.hoisted(() => ({
  mockGetEconomyUser: vi.fn(),
  mockCreateEconomyUser: vi.fn(),
  mockUpdateEconomyUser: vi.fn(),
  mockGetGlobalBank: vi.fn(),
  mockCreateGlobalBank: vi.fn(),
  mockUpdateGlobalBank: vi.fn(),
  mockGetEconomyConfig: vi.fn(),
  mockCreateEconomyConfig: vi.fn(),
  mockUpdateEconomyConfig: vi.fn(),
  mockGetLeaderboard: vi.fn(),
  mockGetLeaderboardEntry: vi.fn(),
  mockUpsertLeaderboard: vi.fn(),
  mockGetUserPosition: vi.fn(),
  mockRemoveFromLeaderboard: vi.fn(),
  mockCreateRouletteGame: vi.fn(),
  mockGetActiveRouletteGame: vi.fn(),
  mockGetRouletteGame: vi.fn(),
  mockUpdateRouletteGame: vi.fn(),
  mockDeleteRouletteGame: vi.fn(),
  mockPlaceRouletteBet: vi.fn(),
  mockUpdateRouletteBet: vi.fn(),
  mockAtomicTransfer: vi.fn(),
  mockAtomicDeposit: vi.fn(),
  mockAtomicWithdraw: vi.fn(),
  mockAtomicAddPocket: vi.fn(),
  mockAtomicSubtractPocket: vi.fn(),
  mockAtomicClaimCooldown: vi.fn(),
  mockAtomicPlaceBet: vi.fn(),
  mockAtomicProcessRouletteResults: vi.fn(),
  mockAtomicCancelRouletteGame: vi.fn(),
}));

const { mockPublishUpdate } = vi.hoisted(() => ({
  mockPublishUpdate: vi.fn(),
}));

vi.mock("../../src/config/repositories/EconomyRepo.js", () => ({
  getEconomyUser: mockGetEconomyUser,
  createEconomyUser: mockCreateEconomyUser,
  updateEconomyUser: mockUpdateEconomyUser,
  getGlobalBank: mockGetGlobalBank,
  createGlobalBank: mockCreateGlobalBank,
  updateGlobalBank: mockUpdateGlobalBank,
  getEconomyConfig: mockGetEconomyConfig,
  createEconomyConfig: mockCreateEconomyConfig,
  updateEconomyConfig: mockUpdateEconomyConfig,
  getLeaderboard: mockGetLeaderboard,
  getLeaderboardEntry: mockGetLeaderboardEntry,
  upsertLeaderboard: mockUpsertLeaderboard,
  getUserPosition: mockGetUserPosition,
  removeFromLeaderboard: mockRemoveFromLeaderboard,
  createRouletteGame: mockCreateRouletteGame,
  getActiveRouletteGame: mockGetActiveRouletteGame,
  getRouletteGame: mockGetRouletteGame,
  updateRouletteGame: mockUpdateRouletteGame,
  deleteRouletteGame: mockDeleteRouletteGame,
  placeRouletteBet: mockPlaceRouletteBet,
  updateRouletteBet: mockUpdateRouletteBet,
  atomicTransfer: mockAtomicTransfer,
  atomicDeposit: mockAtomicDeposit,
  atomicWithdraw: mockAtomicWithdraw,
  atomicAddPocket: mockAtomicAddPocket,
  atomicSubtractPocket: mockAtomicSubtractPocket,
  atomicClaimCooldown: mockAtomicClaimCooldown,
  atomicPlaceBet: mockAtomicPlaceBet,
  atomicProcessRouletteResults: mockAtomicProcessRouletteResults,
  atomicCancelRouletteGame: mockAtomicCancelRouletteGame,
}));

vi.mock("../../src/app/services/economy/LeaderboardService.js", () => ({
  default: {
    publishUpdate: mockPublishUpdate,
    getUserPosition: mockGetUserPosition,
  },
}));

const { EconomyService } = await import(
  "../../src/app/services/economy/EconomyService.js"
);

// =============================================================================
// Default mock user
// =============================================================================

const DEFAULT_USER: IUserEconomy = {
  userId: "user-1",
  guildId: "guild-1",
  username: "TestUser",
  pocket: 1000,
  totalEarned: 0,
  totalLost: 0,
  inJail: false,
  jailReleaseAt: null,
  lastWork: null,
  lastCrime: null,
  lastRob: null,
};

describe("EconomyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // getOrCreateUser
  // ===========================================================================
  describe("getOrCreateUser", () => {
    it("should return existing user without creating", async () => {
      const existingUser = { ...DEFAULT_USER, pocket: 5000 };
      mockGetEconomyUser.mockResolvedValue(existingUser);

      const result = await EconomyService.getOrCreateUser(
        "user-1",
        "TestUser",
        "guild-1",
      );

      expect(mockGetEconomyUser).toHaveBeenCalledWith("guild-1", "user-1");
      expect(mockCreateEconomyUser).not.toHaveBeenCalled();
      expect(result.pocket).toBe(5000);
    });

    it("should create new user with startingMoney when user does not exist", async () => {
      mockGetEconomyUser.mockResolvedValue(null);
      mockGetEconomyConfig.mockResolvedValue({
        guildId: "guild-1",
        startingMoney: 1500,
        workCooldown: 300000,
        crimeCooldown: 900000,
        robCooldown: 1800000,
      });
      mockCreateEconomyUser.mockImplementation((guildId: string, data: Partial<IUserEconomy>) =>
        Promise.resolve({ ...DEFAULT_USER, guildId, ...data } as IUserEconomy),
      );

      const result = await EconomyService.getOrCreateUser(
        "user-1",
        "TestUser",
        "guild-1",
      );

      expect(mockGetEconomyUser).toHaveBeenCalledWith("guild-1", "user-1");
      expect(mockCreateEconomyUser).toHaveBeenCalled();
      expect(result.pocket).toBe(1500);
    });
  });

  // ===========================================================================
  // checkCooldown
  // ===========================================================================
  describe("checkCooldown", () => {
    it("should return onCooldown false when user does not exist", async () => {
      mockGetEconomyUser.mockResolvedValue(null);

      const result = await EconomyService.checkCooldown(
        "user-1",
        "guild-1",
        "work",
      );

      expect(result.onCooldown).toBe(false);
    });

    it("should return onCooldown false when lastUsed is null", async () => {
      const userWithNoLastUsed = { ...DEFAULT_USER, lastWork: null };
      mockGetEconomyUser.mockResolvedValue(userWithNoLastUsed);

      const result = await EconomyService.checkCooldown(
        "user-1",
        "guild-1",
        "work",
      );

      expect(result.onCooldown).toBe(false);
    });

    it("should return onCooldown true when cooldown is active", async () => {
      const justUsed = new Date(Date.now() - 60_000); // 1 minute ago
      const userWithRecentWork = { ...DEFAULT_USER, lastWork: justUsed };
      mockGetEconomyUser.mockResolvedValue(userWithRecentWork);
      mockGetEconomyConfig.mockResolvedValue({
        guildId: "guild-1",
        startingMoney: 1000,
        workCooldown: 300_000, // 5 minutes
        crimeCooldown: 900_000,
        robCooldown: 1_800_000,
      });

      const result = await EconomyService.checkCooldown(
        "user-1",
        "guild-1",
        "work",
      );

      expect(result.onCooldown).toBe(true);
      expect(result.remainingTime).toBeGreaterThan(0);
    });

    it("should return onCooldown false when cooldown has expired", async () => {
      const longAgo = new Date(Date.now() - 600_000); // 10 minutes ago
      const userWithOldWork = { ...DEFAULT_USER, lastWork: longAgo };
      mockGetEconomyUser.mockResolvedValue(userWithOldWork);
      mockGetEconomyConfig.mockResolvedValue({
        guildId: "guild-1",
        startingMoney: 1000,
        workCooldown: 300_000,
        crimeCooldown: 900_000,
        robCooldown: 1800000,
      });

      const result = await EconomyService.checkCooldown(
        "user-1",
        "guild-1",
        "work",
      );

      expect(result.onCooldown).toBe(false);
    });
  });

  // ===========================================================================
  // getBalance
  // ===========================================================================
  describe("getBalance", () => {
    it("should return combined pocket and bank balance", async () => {
      const mockUser = { ...DEFAULT_USER, pocket: 500 };
      const mockBank = { userId: "user-1", username: "TestUser", bank: 300 };
      mockGetEconomyUser.mockResolvedValue(mockUser);
      mockGetGlobalBank.mockResolvedValue(mockBank);

      const result = await EconomyService.getBalance("user-1", "guild-1");

      expect(result.pocket).toBe(500);
      expect(result.bank).toBe(300);
      expect(result.total).toBe(800);
    });

    it("should return zeros when user does not exist", async () => {
      mockGetEconomyUser.mockResolvedValue(null);
      mockGetGlobalBank.mockResolvedValue(null);

      const result = await EconomyService.getBalance("user-1", "guild-1");

      expect(result.pocket).toBe(0);
      expect(result.bank).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  // ===========================================================================
  // isInJail
  // ===========================================================================
  describe("isInJail", () => {
    it("should return false when user does not exist", async () => {
      mockGetEconomyUser.mockResolvedValue(null);

      const result = await EconomyService.isInJail("user-1", "guild-1");

      expect(result).toBe(false);
    });

    it("should return false when user is not in jail", async () => {
      mockGetEconomyUser.mockResolvedValue({ ...DEFAULT_USER, inJail: false });

      const result = await EconomyService.isInJail("user-1", "guild-1");

      expect(result).toBe(false);
    });

    it("should return true when user is in jail with future release time", async () => {
      const futureRelease = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
      mockGetEconomyUser.mockResolvedValue({
        ...DEFAULT_USER,
        inJail: true,
        jailReleaseAt: futureRelease,
      });

      const result = await EconomyService.isInJail("user-1", "guild-1");

      expect(result).toBe(true);
    });

    it("should return false and update user when jail has expired", async () => {
      const pastRelease = new Date(Date.now() - 60_000); // 1 min ago
      mockGetEconomyUser.mockResolvedValue({
        ...DEFAULT_USER,
        inJail: true,
        jailReleaseAt: pastRelease,
      });
      mockUpdateEconomyUser.mockResolvedValue({
        ...DEFAULT_USER,
        inJail: false,
        jailReleaseAt: null,
      });

      const result = await EconomyService.isInJail("user-1", "guild-1");

      expect(result).toBe(false);
      expect(mockUpdateEconomyUser).toHaveBeenCalledWith("guild-1", "user-1", {
        inJail: false,
        jailReleaseAt: null,
      });
    });
  });

  // ===========================================================================
  // escapeAttempt (via sendToJail + isInJail flow)
  // The service doesn't have an escapeAttempt method directly — we test the
  // components: sendToJail creates a jail record, isInJail checks it.
  // ===========================================================================
  describe("sendToJail", () => {
    it("should set jail record with correct release time", async () => {
      mockUpdateEconomyUser.mockResolvedValue({ ...DEFAULT_USER });

      const releaseTime = await EconomyService.sendToJail("user-1", "guild-1", 30);

      expect(mockUpdateEconomyUser).toHaveBeenCalledWith(
        "guild-1",
        "user-1",
        expect.objectContaining({
          inJail: true,
          jailReleaseAt: expect.any(Date),
        }),
      );
      // release time should be approximately 30 min from now
      const expected = Date.now() + 30 * 60 * 1000;
      expect(Math.abs(releaseTime.getTime() - expected)).toBeLessThan(5000);
    });
  });

  // ===========================================================================
  // addPocket
  // ===========================================================================
  describe("addPocket", () => {
    it("should add pocket and return updated user", async () => {
      const updatedUser = { ...DEFAULT_USER, pocket: 1500 };
      mockAtomicAddPocket.mockResolvedValue(updatedUser);

      const guild = { id: "guild-1" } as unknown as any;
      const result = await EconomyService.addPocket(
        "user-1",
        "guild-1",
        500,
        "TestUser",
        guild,
      );

      expect(mockAtomicAddPocket).toHaveBeenCalledWith(
        "user-1",
        "guild-1",
        500,
        undefined,
      );
      expect(result.pocket).toBe(1500);
    });
  });

  // ===========================================================================
  // subtractPocket
  // ===========================================================================
  describe("subtractPocket", () => {
    it("should subtract pocket and return updated user", async () => {
      const updatedUser = { ...DEFAULT_USER, pocket: 500 };
      mockAtomicSubtractPocket.mockResolvedValue(updatedUser);

      const guild = { id: "guild-1" } as unknown as any;
      const result = await EconomyService.subtractPocket(
        "user-1",
        "guild-1",
        500,
        "TestUser",
        guild,
      );

      expect(mockAtomicSubtractPocket).toHaveBeenCalledWith(
        "user-1",
        "guild-1",
        500,
        undefined,
      );
      expect(result.pocket).toBe(500);
    });
  });
});
