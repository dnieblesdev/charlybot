import { prisma } from "../../../infrastructure/storage/prismaClient.js";
import logger from "../../../utils/logger.js";
import LeaderboardService from "./LeaderboardService.js";
import { Guild } from "discord.js";

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
  ) {
    try {
      const game = await prisma.rouletteGame.create({
        data: {
          guildId,
          channelId,
          messageId,
          status: "waiting",
        },
        include: {
          bets: true,
        },
      });

      logger.info(`Created roulette game ${game.id} in guild ${guildId}`);
      return game;
    } catch (error) {
      logger.error("Error creating roulette game:", error);
      throw error;
    }
  }

  // Obtener un juego activo
  static async getActiveGame(channelId: string) {
    try {
      const game = await prisma.rouletteGame.findFirst({
        where: {
          channelId,
          status: "waiting",
        },
        include: {
          bets: true,
        },
      });

      return game;
    } catch (error) {
      logger.error("Error getting active game:", error);
      throw error;
    }
  }

  // Realizar una apuesta
  static async placeBet(
    gameId: number,
    userId: string,
    guildId: string,
    amount: number,
    betType: "color" | "number",
    betValue: string,
    username: string,
    guild: Guild,
  ) {
    try {
      // Validar que el usuario tenga suficiente dinero en el bolsillo
      const user = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!user || user.pocket < amount) {
        throw new Error("Fondos insuficientes en el bolsillo");
      }

      // Restar el dinero del bolsillo
      await prisma.userEconomy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          pocket: { decrement: amount },
        },
      });

      // Actualizar leaderboard
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      // Crear la apuesta
      const bet = await prisma.rouletteBet.create({
        data: {
          gameId,
          userId,
          guildId,
          amount,
          betType,
          betValue,
        },
      });

      logger.info(
        `User ${userId} placed bet of ${amount} on ${betType}:${betValue} in game ${gameId}`,
      );
      return bet;
    } catch (error) {
      logger.error("Error placing bet:", error);
      throw error;
    }
  }

  // Girar la ruleta
  static async spin(gameId: number) {
    try {
      // Generar color basado en probabilidades personalizadas
      // Verde: 15%, Rojo: 42.5%, Negro: 42.5%
      const random = Math.random();
      let winningColor: string;

      if (random < 0.15) {
        winningColor = "green";
      } else if (random < 0.575) {
        // 0.15 + 0.425 = 0.575
        winningColor = "red";
      } else {
        winningColor = "black";
      }

      // Generar número ganador según el color
      let winningNumber: number = 0;
      if (winningColor === "green") {
        winningNumber = 0;
      } else if (winningColor === "red") {
        // Seleccionar un número rojo aleatorio
        winningNumber =
          this.RED_NUMBERS[
            Math.floor(Math.random() * this.RED_NUMBERS.length)
          ] ?? 1;
      } else {
        // Seleccionar un número negro aleatorio
        winningNumber =
          this.BLACK_NUMBERS[
            Math.floor(Math.random() * this.BLACK_NUMBERS.length)
          ] ?? 2;
      }

      // Actualizar el juego
      const game = await prisma.rouletteGame.update({
        where: { id: gameId },
        data: {
          status: "spinning",
          winningNumber,
          winningColor,
          spinTime: new Date(),
        },
        include: {
          bets: true,
        },
      });

      logger.info(
        `Roulette game ${gameId} spun: ${winningNumber} ${winningColor}`,
      );
      return game;
    } catch (error) {
      logger.error("Error spinning roulette:", error);
      throw error;
    }
  }

  // Procesar resultados y pagar ganancias
  static async processResults(gameId: number, guild: Guild) {
    try {
      const game = await prisma.rouletteGame.findUnique({
        where: { id: gameId },
        include: {
          bets: true,
        },
      });

      if (!game || game.winningNumber === undefined || !game.winningColor) {
        throw new Error("Game not found or not spun yet");
      }

      const results = [];

      // Procesar cada apuesta
      for (const bet of game.bets) {
        let won = false;
        let winAmount = 0;

        if (bet.betType === "color") {
          // Apuesta por color
          if (bet.betValue === game.winningColor) {
            won = true;
            winAmount = bet.amount * 2; // x2 para color
          }
        } else if (bet.betType === "number") {
          // Apuesta por número
          if (parseInt(bet.betValue) === game.winningNumber) {
            won = true;
            winAmount = bet.amount * 36; // x36 para número
          }
        }

        // Actualizar la apuesta
        await prisma.rouletteBet.update({
          where: { id: bet.id },
          data: {
            result: won ? "win" : "lose",
            winAmount: won ? winAmount : 0,
          },
        });

        // Si ganó, agregar el dinero al bolsillo
        if (won) {
          const userEconomy = await prisma.userEconomy.update({
            where: {
              userId_guildId: {
                userId: bet.userId,
                guildId: bet.guildId,
              },
            },
            data: {
              pocket: { increment: winAmount },
              totalEarned: { increment: winAmount },
            },
          });

          // Actualizar leaderboard
          await LeaderboardService.updateLeaderboard(
            bet.userId,
            bet.guildId,
            userEconomy.username,
            guild,
          );
        } else {
          const userEconomy = await prisma.userEconomy.update({
            where: {
              userId_guildId: {
                userId: bet.userId,
                guildId: bet.guildId,
              },
            },
            data: {
              totalLost: { increment: bet.amount },
            },
          });

          // Actualizar leaderboard (perdió pero el total puede haber cambiado)
          await LeaderboardService.updateLeaderboard(
            bet.userId,
            bet.guildId,
            userEconomy.username,
            guild,
          );
        }

        results.push({
          userId: bet.userId,
          betType: bet.betType,
          betValue: bet.betValue,
          amount: bet.amount,
          won,
          winAmount,
        });
      }

      // Finalizar el juego
      await prisma.rouletteGame.update({
        where: { id: gameId },
        data: {
          status: "finished",
          endTime: new Date(),
        },
      });

      logger.info(`Processed results for roulette game ${gameId}`);
      return {
        winningNumber: game.winningNumber,
        winningColor: game.winningColor,
        results,
      };
    } catch (error) {
      logger.error("Error processing roulette results:", error);
      throw error;
    }
  }

  // Obtener todas las apuestas de un juego
  static async getGameBets(gameId: number) {
    try {
      const bets = await prisma.rouletteBet.findMany({
        where: { gameId },
        include: {
          user: true,
        },
      });

      return bets;
    } catch (error) {
      logger.error("Error getting game bets:", error);
      throw error;
    }
  }

  // Cancelar un juego y devolver las apuestas
  static async cancelGame(gameId: number, guild: Guild) {
    try {
      const game = await prisma.rouletteGame.findUnique({
        where: { id: gameId },
        include: {
          bets: true,
        },
      });

      if (!game) {
        throw new Error("Game not found");
      }

      // Devolver el dinero a los jugadores
      for (const bet of game.bets) {
        const userEconomy = await prisma.userEconomy.update({
          where: {
            userId_guildId: {
              userId: bet.userId,
              guildId: bet.guildId,
            },
          },
          data: {
            pocket: { increment: bet.amount },
          },
        });

        // Actualizar leaderboard
        await LeaderboardService.updateLeaderboard(
          bet.userId,
          bet.guildId,
          userEconomy.username,
          guild,
        );
      }

      // Eliminar las apuestas
      await prisma.rouletteBet.deleteMany({
        where: { gameId },
      });

      // Eliminar el juego
      await prisma.rouletteGame.delete({
        where: { id: gameId },
      });

      logger.info(`Cancelled roulette game ${gameId}`);
    } catch (error) {
      logger.error("Error cancelling game:", error);
      throw error;
    }
  }

  // Obtener el color del número
  static getNumberColor(number: number): string {
    if (number === 0) return "🟢";
    if (this.RED_NUMBERS.includes(number)) return "🔴";
    if (this.BLACK_NUMBERS.includes(number)) return "⚫";
    return "❓";
  }

  // Validar tipo de apuesta
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
