import logger from "../../../utils/logger.js";
import LeaderboardService from "./LeaderboardService.js";
import { Guild } from "discord.js";
import * as EconomyRepo from "../../../config/repositories/EconomyRepo";
import type { RouletteGame, RouletteBet } from "@charlybot/shared";

export class RouletteService {
  // Números rojos y negros de la ruleta
  private static readonly RED_NUMBERS = [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ];
  private static readonly BLACK_NUMBERS = [
    2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
  ];

  // Crear un nuevo juego de ruleta
  static async createGame(
    guildId: string,
    channelId: string,
    messageId?: string,
  ): Promise<RouletteGame> {
    try {
      const game = await EconomyRepo.createRouletteGame(guildId, {
        guildId,
        channelId,
        messageId,
        status: "waiting",
      });

      logger.info(
        `Created roulette game ${game.id} in guild ${guildId} via API`,
      );
      return game;
    } catch (error) {
      logger.error("Error creating roulette game via API:", error);
      throw error;
    }
  }

  // Obtener un juego activo
  static async getActiveGame(
    guildId: string,
    channelId: string,
  ): Promise<RouletteGame | null> {
    try {
      return await EconomyRepo.getActiveRouletteGame(guildId, channelId);
    } catch (error) {
      logger.error("Error getting active game via API:", error);
      throw error;
    }
  }

  // Realizar una apuesta — ATOMIC
  static async placeBet(
    gameId: number,
    userId: string,
    guildId: string,
    amount: number,
    betType: "color" | "number",
    betValue: string,
    username: string,
    guild: Guild,
  ): Promise<RouletteBet> {
    try {
      // Atomic: fund verification + deduction + bet creation in one operation
      const bet = await EconomyRepo.atomicPlaceBet(
        userId,
        guildId,
        gameId,
        amount,
        betType,
        betValue,
      );

      // Update leaderboard (non-critical, can stay async)
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      logger.info(
        `User ${userId} placed bet of ${amount} on ${betType}:${betValue} in game ${gameId} via API`,
      );
      return bet;
    } catch (error) {
      logger.error("Error placing bet via API:", error);
      throw error;
    }
  }

  // Girar la ruleta
  static async spin(guildId: string, gameId: number): Promise<RouletteGame> {
    try {
      // Generar color basado en probabilidades personalizadas
      const random = Math.random();
      let winningColor: string;

      if (random < 0.15) {
        winningColor = "green";
      } else if (random < 0.575) {
        winningColor = "red";
      } else {
        winningColor = "black";
      }

      let winningNumber: number = 0;
      if (winningColor === "green") {
        winningNumber = 0;
      } else if (winningColor === "red") {
        winningNumber =
          this.RED_NUMBERS[
            Math.floor(Math.random() * this.RED_NUMBERS.length)
          ] ?? 1;
      } else {
        winningNumber =
          this.BLACK_NUMBERS[
            Math.floor(Math.random() * this.BLACK_NUMBERS.length)
          ] ?? 2;
      }

      // Verificar que el juego esté en espera antes de girar
      const currentGame = await EconomyRepo.getRouletteGame(guildId, gameId);
      if (!currentGame || currentGame.status !== "waiting") {
        throw new Error("Game is not in waiting status");
      }

      // Actualizar el juego via API
      const game = await EconomyRepo.updateRouletteGame(guildId, gameId, {
        status: "spinning",
        winningNumber,
        winningColor,
        spinTime: new Date(),
      });

      logger.info(
        `Roulette game ${gameId} spun: ${winningNumber} ${winningColor} via API`,
      );
      return game;
    } catch (error) {
      logger.error("Error spinning roulette via API:", error);
      throw error;
    }
  }

  // Procesar resultados y pagar ganancias — ATOMIC
  static async processResults(guildId: string, gameId: number, guild: Guild) {
    try {
      const game = (await EconomyRepo.getRouletteGame(
        guildId,
        gameId,
      )) as RouletteGame & { bets: RouletteBet[] };

      if (!game || game.winningNumber === null || !game.winningColor) {
        throw new Error("Game not found or not spun yet");
      }

      // Atomic: calculates wins/losses, updates bets, updates user pockets
      const atomicResult = await EconomyRepo.atomicProcessRouletteResults(
        gameId,
        guildId,
        game.winningNumber,
        game.winningColor,
      );

      // Update leaderboards for all affected users (non-critical, async)
      const leaderboardUpdates = atomicResult.results.map((result) =>
        LeaderboardService.updateLeaderboard(
          result.userId,
          guildId,
          "", // username unknown here, but leaderboard can still be updated
          guild,
        ),
      );
      await Promise.all(leaderboardUpdates);

      // Finalize game status
      await EconomyRepo.updateRouletteGame(guildId, gameId, {
        status: "finished",
        endTime: new Date(),
      });

      logger.info(`Processed results for roulette game ${gameId} via API`);

      // Build result map keyed by betId for deterministic lookup
      const resultMap = new Map(atomicResult.results.map(r => [r.betId, r]));

      // Format results to match original interface
      const results = game.bets.map((bet) => {
        const result = resultMap.get(bet.id);
        return {
          userId: bet.userId,
          betType: bet.betType,
          betValue: bet.betValue,
          amount: bet.amount,
          won: result?.won ?? false,
          winAmount: result?.winAmount ?? 0,
        };
      });

      return {
        winningNumber: game.winningNumber,
        winningColor: game.winningColor,
        results,
      };
    } catch (error) {
      logger.error("Error processing roulette results via API:", error);
      throw error;
    }
  }

  // Obtener todas las apuestas de un juego
  static async getGameBets(
    guildId: string,
    gameId: number,
  ): Promise<RouletteBet[]> {
    try {
      const game = (await EconomyRepo.getRouletteGame(
        guildId,
        gameId,
      )) as RouletteGame & { bets: RouletteBet[] };
      return game.bets || [];
    } catch (error) {
      logger.error("Error getting game bets via API:", error);
      throw error;
    }
  }

  // Cancelar un juego y devolver las apuestas — ATOMIC
  static async cancelGame(guildId: string, gameId: number, guild: Guild) {
    try {
      // Atomic: refunds all bets and deletes the game
      const cancelResult = await EconomyRepo.atomicCancelRouletteGame(
        gameId,
        guildId,
      );

      // Get all bets to update leaderboards
      const game = (await EconomyRepo.getRouletteGame(
        guildId,
        gameId,
      )) as RouletteGame & { bets: RouletteBet[] };

      if (game.bets) {
        // Update leaderboards for all refunded users (non-critical, async)
        const leaderboardUpdates = game.bets.map((bet) =>
          LeaderboardService.updateLeaderboard(
            bet.userId,
            guildId,
            "", // username unknown, leaderboard will use stored username
            guild,
          ),
        );
        await Promise.all(leaderboardUpdates);
      }

      logger.info(
        `Cancelled roulette game ${gameId} via API — ${cancelResult.refundedBets} bets refunded`,
      );
    } catch (error) {
      logger.error("Error cancelling game via API:", error);
      throw error;
    }
  }

  static getNumberColor(number: number): string {
    if (number === 0) return "🟢";
    if (this.RED_NUMBERS.includes(number)) return "🔴";
    if (this.BLACK_NUMBERS.includes(number)) return "⚫";
    return "❓";
  }

  static validateBet(betType: string, betValue: string): boolean {
    if (betType === "color") {
      return ["red", "black", "green"].includes(betValue.toLowerCase());
    } else if (betType === "number") {
      const num = parseInt(betValue);
      return !isNaN(num) && num >= 0 && num <= 36;
    }
    return false;
  }
}
