import type {
  IUserEconomy,
  IGlobalBank,
  IEconomyConfig,
  Leaderboard,
  RouletteGame,
  RouletteBet,
} from "@charlybot/shared";

function createMockFn<T>(): (...args: unknown[]) => Promise<T> {
  return (() => Promise.resolve({} as T)) as (...args: unknown[]) => Promise<T>;
}

// Default mock user — returned when a new user is created
export const DEFAULT_MOCK_USER: IUserEconomy = {
  userId: "user-123",
  guildId: "guild-456",
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

export const DEFAULT_MOCK_BANK: IGlobalBank = {
  userId: "user-123",
  username: "TestUser",
  bank: 0,
};

export const DEFAULT_MOCK_CONFIG: IEconomyConfig = {
  guildId: "guild-456",
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

export interface MockEconomyRepo {
  getEconomyUser: ReturnType<typeof vi.fn>;
  createEconomyUser: ReturnType<typeof vi.fn>;
  updateEconomyUser: ReturnType<typeof vi.fn>;
  getGlobalBank: ReturnType<typeof vi.fn>;
  createGlobalBank: ReturnType<typeof vi.fn>;
  updateGlobalBank: ReturnType<typeof vi.fn>;
  getEconomyConfig: ReturnType<typeof vi.fn>;
  createEconomyConfig: ReturnType<typeof vi.fn>;
  updateEconomyConfig: ReturnType<typeof vi.fn>;
  getLeaderboard: ReturnType<typeof vi.fn>;
  getLeaderboardEntry: ReturnType<typeof vi.fn>;
  upsertLeaderboard: ReturnType<typeof vi.fn>;
  getUserPosition: ReturnType<typeof vi.fn>;
  removeFromLeaderboard: ReturnType<typeof vi.fn>;
  createRouletteGame: ReturnType<typeof vi.fn>;
  getActiveRouletteGame: ReturnType<typeof vi.fn>;
  getRouletteGame: ReturnType<typeof vi.fn>;
  updateRouletteGame: ReturnType<typeof vi.fn>;
  deleteRouletteGame: ReturnType<typeof vi.fn>;
  placeRouletteBet: ReturnType<typeof vi.fn>;
  updateRouletteBet: ReturnType<typeof vi.fn>;
  atomicTransfer: ReturnType<typeof vi.fn>;
  atomicDeposit: ReturnType<typeof vi.fn>;
  atomicWithdraw: ReturnType<typeof vi.fn>;
  atomicAddPocket: ReturnType<typeof vi.fn>;
  atomicSubtractPocket: ReturnType<typeof vi.fn>;
  atomicClaimCooldown: ReturnType<typeof vi.fn>;
  atomicPlaceBet: ReturnType<typeof vi.fn>;
  atomicProcessRouletteResults: ReturnType<typeof vi.fn>;
  atomicCancelRouletteGame: ReturnType<typeof vi.fn>;
}

export function createMockEconomyRepo(
  overrides?: Partial<{
    [K in keyof MockEconomyRepo]: MockEconomyRepo[K] | NonNullable<MockEconomyRepo[K]>;
  }>,
): MockEconomyRepo {
  const mock: MockEconomyRepo = {
    getEconomyUser: vi.fn(() => Promise.resolve(null)),
    createEconomyUser: vi.fn((guildId: string, data: Partial<IUserEconomy>) =>
      Promise.resolve({ ...DEFAULT_MOCK_USER, guildId, ...data } as IUserEconomy),
    ),
    updateEconomyUser: vi.fn((guildId: string, userId: string, data: Partial<IUserEconomy>) =>
      Promise.resolve({ ...DEFAULT_MOCK_USER, guildId, userId, ...data } as IUserEconomy),
    ),
    getGlobalBank: vi.fn(() => Promise.resolve(null)),
    createGlobalBank: vi.fn((guildId: string, data: Partial<IGlobalBank>) =>
      Promise.resolve({ ...DEFAULT_MOCK_BANK, ...data } as IGlobalBank),
    ),
    updateGlobalBank: vi.fn((guildId: string, userId: string, data: Partial<IGlobalBank>) =>
      Promise.resolve({ ...DEFAULT_MOCK_BANK, userId, ...data } as IGlobalBank),
    ),
    getEconomyConfig: vi.fn(() => Promise.resolve(null)),
    createEconomyConfig: vi.fn((guildId: string, data: Partial<IEconomyConfig>) =>
      Promise.resolve({ ...DEFAULT_MOCK_CONFIG, guildId, ...data } as IEconomyConfig),
    ),
    updateEconomyConfig: vi.fn((guildId: string, data: Partial<IEconomyConfig>) =>
      Promise.resolve({ ...DEFAULT_MOCK_CONFIG, guildId, ...data } as IEconomyConfig),
    ),
    getLeaderboard: vi.fn(() => Promise.resolve([] as Leaderboard[])),
    getLeaderboardEntry: vi.fn(() => Promise.resolve(null)),
    upsertLeaderboard: vi.fn((guildId: string, data: Partial<Leaderboard>) =>
      Promise.resolve({} as Leaderboard),
    ),
    getUserPosition: vi.fn(() => Promise.resolve(null)),
    removeFromLeaderboard: vi.fn(() => Promise.resolve()),
    createRouletteGame: vi.fn((guildId: string, data: Partial<RouletteGame>) =>
      Promise.resolve({ id: 1, guildId, ...data } as RouletteGame),
    ),
    getActiveRouletteGame: vi.fn(() => Promise.resolve(null)),
    getRouletteGame: vi.fn((guildId: string, gameId: number) =>
      Promise.resolve({ id: gameId, guildId } as RouletteGame),
    ),
    updateRouletteGame: vi.fn((guildId: string, gameId: number, data: Partial<RouletteGame>) =>
      Promise.resolve({ id: gameId, guildId, ...data } as RouletteGame),
    ),
    deleteRouletteGame: vi.fn(() => Promise.resolve()),
    placeRouletteBet: vi.fn((guildId: string, gameId: number, data: Partial<RouletteBet>) =>
      Promise.resolve({ id: 1, gameId, guildId, ...data } as RouletteBet),
    ),
    updateRouletteBet: vi.fn((guildId: string, betId: number, data: Partial<RouletteBet>) =>
      Promise.resolve({ id: betId, guildId, ...data } as RouletteBet),
    ),
    atomicTransfer: vi.fn(() =>
      Promise.resolve({
        success: true,
        fromUser: DEFAULT_MOCK_USER,
        toUser: { ...DEFAULT_MOCK_USER, userId: "user-789" },
      }),
    ),
    atomicDeposit: vi.fn(() =>
      Promise.resolve({ success: true, user: DEFAULT_MOCK_USER, bank: DEFAULT_MOCK_BANK }),
    ),
    atomicWithdraw: vi.fn(() =>
      Promise.resolve({ success: true, user: DEFAULT_MOCK_USER, bank: DEFAULT_MOCK_BANK }),
    ),
    atomicAddPocket: vi.fn((userId: string, guildId: string, amount: number) =>
      Promise.resolve({ ...DEFAULT_MOCK_USER, userId, guildId, pocket: amount } as IUserEconomy),
    ),
    atomicSubtractPocket: vi.fn((userId: string, guildId: string, amount: number) =>
      Promise.resolve({
        ...DEFAULT_MOCK_USER,
        userId,
        guildId,
        pocket: Math.max(0, DEFAULT_MOCK_USER.pocket - amount),
      } as IUserEconomy),
    ),
    atomicClaimCooldown: vi.fn(() =>
      Promise.resolve({ success: true, user: DEFAULT_MOCK_USER }),
    ),
    atomicPlaceBet: vi.fn((userId: string, guildId: string, gameId: number, amount: number) =>
      Promise.resolve({ id: 1, userId, guildId, gameId, amount } as RouletteBet),
    ),
    atomicProcessRouletteResults: vi.fn(() =>
      Promise.resolve({ gameId: 1, results: [] }),
    ),
    atomicCancelRouletteGame: vi.fn(() => Promise.resolve({ gameId: 1, refundedBets: 0 })),
  };

  // Apply overrides — allows tests to customize specific functions
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) {
        (mock as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }

  return mock;
}
