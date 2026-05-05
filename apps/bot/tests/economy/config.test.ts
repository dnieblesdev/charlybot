import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IEconomyConfig } from "@charlybot/shared";

// =============================================================================
// vi.hoisted() — create mock function references BEFORE vi.mock() hoisting
// =============================================================================

const {
  mockGetEconomyConfig,
  mockCreateEconomyConfig,
  mockUpdateEconomyConfig,
} = vi.hoisted(() => ({
  mockGetEconomyConfig: vi.fn(),
  mockCreateEconomyConfig: vi.fn(),
  mockUpdateEconomyConfig: vi.fn(),
}));

vi.mock("../../src/config/repositories/EconomyRepo.js", () => ({
  getEconomyConfig: mockGetEconomyConfig,
  createEconomyConfig: mockCreateEconomyConfig,
  updateEconomyConfig: mockUpdateEconomyConfig,
}));

const { EconomyConfigService } = await import(
  "../../src/app/services/economy/EconomyConfigService.js"
);

// =============================================================================
// Default mock config
// =============================================================================

const DEFAULT_MOCK_CONFIG: IEconomyConfig = {
  guildId: "test-guild",
  startingMoney: 1000,
  workCooldown: 300000,
  crimeCooldown: 900000,
  robCooldown: 1800000,
  workMinAmount: 100,
  workMaxAmount: 300,
  crimeMultiplier: 3,
  jailTimeWork: 30,
  jailTimeRob: 45,
  rouletteChannelId: null,
};

describe("EconomyConfigService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // defaults
  // ===========================================================================
  describe("defaults", () => {
    it("should return default config values when repo returns null", async () => {
      mockGetEconomyConfig.mockResolvedValue(null);
      mockCreateEconomyConfig.mockImplementation((guildId: string, data: Partial<IEconomyConfig>) =>
        Promise.resolve({ ...DEFAULT_MOCK_CONFIG, guildId, ...data } as IEconomyConfig),
      );

      const result = await EconomyConfigService.getOrCreateConfig("test-guild");

      expect(result.startingMoney).toBe(1000);
      expect(result.workCooldown).toBe(300000);
      expect(result.crimeCooldown).toBe(900000);
      expect(result.robCooldown).toBe(1800000);
    });

    it("should call getEconomyConfig on getOrCreateConfig", async () => {
      mockGetEconomyConfig.mockResolvedValue(DEFAULT_MOCK_CONFIG);

      await EconomyConfigService.getOrCreateConfig("test-guild");

      expect(mockGetEconomyConfig).toHaveBeenCalledWith("test-guild");
    });
  });

  // ===========================================================================
  // getCooldown
  // ===========================================================================
  describe("getCooldown", () => {
    it("should return correct cooldowns for each type", async () => {
      mockGetEconomyConfig.mockResolvedValue(DEFAULT_MOCK_CONFIG);
      mockCreateEconomyConfig.mockResolvedValue(DEFAULT_MOCK_CONFIG);

      const [workCooldown, crimeCooldown, robCooldown] = await Promise.all([
        EconomyConfigService.getCooldown("test-guild", "work"),
        EconomyConfigService.getCooldown("test-guild", "crime"),
        EconomyConfigService.getCooldown("test-guild", "rob"),
      ]);

      expect(workCooldown).toBe(300000);
      expect(crimeCooldown).toBe(900000);
      expect(robCooldown).toBe(1800000);
    });
  });

  // ===========================================================================
  // updateWorkAmounts
  // ===========================================================================
  describe("updateWorkAmounts", () => {
    it("should throw when minAmount is greater than maxAmount", async () => {
      await expect(
        EconomyConfigService.updateWorkAmounts("test-guild", 500, 100),
      ).rejects.toThrow("El mínimo no puede ser mayor que el máximo");
    });

    it("should call updateEconomyConfig with valid amounts", async () => {
      const updatedConfig = {
        ...DEFAULT_MOCK_CONFIG,
        workMinAmount: 100,
        workMaxAmount: 500,
      };
      mockUpdateEconomyConfig.mockResolvedValue(updatedConfig);

      const result = await EconomyConfigService.updateWorkAmounts("test-guild", 100, 500);

      expect(mockUpdateEconomyConfig).toHaveBeenCalledWith("test-guild", {
        workMinAmount: 100,
        workMaxAmount: 500,
      });
      expect(result.workMinAmount).toBe(100);
      expect(result.workMaxAmount).toBe(500);
    });

    it("should accept equal min and max (edge case)", async () => {
      const updatedConfig = {
        ...DEFAULT_MOCK_CONFIG,
        workMinAmount: 300,
        workMaxAmount: 300,
      };
      mockUpdateEconomyConfig.mockResolvedValue(updatedConfig);

      const result = await EconomyConfigService.updateWorkAmounts("test-guild", 300, 300);

      expect(result.workMinAmount).toBe(300);
      expect(result.workMaxAmount).toBe(300);
    });
  });
});
