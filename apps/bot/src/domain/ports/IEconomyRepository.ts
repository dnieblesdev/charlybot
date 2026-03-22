import type {
  IUserEconomy,
  IGlobalBank,
  IEconomyConfig,
  RouletteGame,
  RouletteBet,
  Leaderboard,
} from "@charlybot/shared";

export interface IEconomyRepository {
  getUser(guildId: string, userId: string): Promise<IUserEconomy | null>;
  createUser(guildId: string, data: IUserEconomy): Promise<IUserEconomy>;
  updateUser(
    guildId: string,
    userId: string,
    data: Partial<IUserEconomy>,
  ): Promise<IUserEconomy>;

  getGlobalBank(guildId: string, userId: string): Promise<IGlobalBank | null>;
  createGlobalBank(guildId: string, data: IGlobalBank): Promise<IGlobalBank>;
  updateGlobalBank(
    guildId: string,
    userId: string,
    data: Partial<IGlobalBank>,
  ): Promise<IGlobalBank>;

  getConfig(guildId: string): Promise<IEconomyConfig | null>;
  createConfig(guildId: string, data: IEconomyConfig): Promise<IEconomyConfig>;
  updateConfig(
    guildId: string,
    data: Partial<IEconomyConfig>,
  ): Promise<IEconomyConfig>;

  // Leaderboard
  getLeaderboard(guildId: string, limit?: number): Promise<Leaderboard[]>;
  getLeaderboardEntry(
    guildId: string,
    userId: string,
  ): Promise<Leaderboard | null>;
  upsertLeaderboard(
    guildId: string,
    data: Partial<Leaderboard>,
  ): Promise<Leaderboard>;
  getUserPosition(guildId: string, userId: string): Promise<number | null>;
  removeFromLeaderboard(guildId: string, userId: string): Promise<void>;

  // Roulette
  createRouletteGame(
    guildId: string,
    data: Partial<RouletteGame>,
  ): Promise<RouletteGame>;
  getActiveRouletteGame(
    guildId: string,
    channelId: string,
  ): Promise<RouletteGame | null>;
  placeRouletteBet(
    guildId: string,
    gameId: number,
    data: Partial<RouletteBet>,
  ): Promise<RouletteBet>;
  updateRouletteGame(
    guildId: string,
    gameId: number,
    data: Partial<RouletteGame>,
  ): Promise<RouletteGame>;
  getRouletteGame(guildId: string, gameId: number): Promise<RouletteGame>;
  updateRouletteBet(
    guildId: string,
    betId: number,
    data: Partial<RouletteBet>,
  ): Promise<RouletteBet>;
  deleteRouletteGame(guildId: string, gameId: number): Promise<void>;
}
