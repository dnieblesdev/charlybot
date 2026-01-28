import { prisma } from "../../../infrastructure/storage/prismaClient.js";
import logger from "../../../utils/logger.js";
import { EconomyConfigService } from "./EconomyConfigService.js";
import LeaderboardService from "./LeaderboardService.js";
import { Guild } from "discord.js";

export class EconomyService {
  // Obtener o crear usuario en la economía (por servidor)
  static async getOrCreateUser(
    userId: string,
    username: string,
    guildId: string,
  ) {
    try {
      let user = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!user) {
        // Obtener dinero inicial de la configuración del servidor
        const config = await EconomyConfigService.getOrCreateConfig(guildId);
        const startingMoney = config.startingMoney;

        user = await prisma.userEconomy.create({
          data: {
            userId,
            guildId,
            username,
            pocket: startingMoney,
          },
        });
        logger.info(
          `Created new economy user: ${username} (${userId}) in guild ${guildId} with $${startingMoney}`,
        );
      }

      return user;
    } catch (error) {
      logger.error("Error getting or creating user:", error);
      throw error;
    }
  }

  // Obtener o crear banco global
  static async getOrCreateGlobalBank(userId: string, username: string) {
    try {
      let bank = await prisma.globalBank.findUnique({
        where: { userId },
      });

      if (!bank) {
        bank = await prisma.globalBank.create({
          data: {
            userId,
            username,
            bank: 0,
          },
        });
        logger.info(`Created global bank for user: ${username} (${userId})`);
      }

      return bank;
    } catch (error) {
      logger.error("Error getting or creating global bank:", error);
      throw error;
    }
  }

  // Verificar si el usuario está en prisión (por servidor)
  static async isInJail(userId: string, guildId: string): Promise<boolean> {
    try {
      const user = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!user) return false;

      if (user.inJail && user.jailReleaseAt) {
        // Verificar si ya cumplió su condena
        if (new Date() >= user.jailReleaseAt) {
          await prisma.userEconomy.update({
            where: {
              userId_guildId: {
                userId,
                guildId,
              },
            },
            data: {
              inJail: false,
              jailReleaseAt: null,
            },
          });
          return false;
        }
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Error checking jail status:", error);
      return false;
    }
  }

  // Enviar a prisión (por servidor)
  static async sendToJail(
    userId: string,
    guildId: string,
    minutes: number = 30,
  ) {
    try {
      const releaseTime = new Date();
      releaseTime.setMinutes(releaseTime.getMinutes() + minutes);

      await prisma.userEconomy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          inJail: true,
          jailReleaseAt: releaseTime,
        },
      });

      logger.info(
        `User ${userId} sent to jail in guild ${guildId} until ${releaseTime}`,
      );
      return releaseTime;
    } catch (error) {
      logger.error("Error sending user to jail:", error);
      throw error;
    }
  }

  // Agregar dinero al bolsillo (por servidor)
  static async addPocket(
    userId: string,
    guildId: string,
    amount: number,
    username: string,
    guild: Guild,
  ) {
    try {
      const user = await prisma.userEconomy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          pocket: { increment: amount },
          totalEarned: { increment: amount },
        },
      });

      // Actualizar leaderboard
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      return user;
    } catch (error) {
      logger.error("Error adding to pocket:", error);
      throw error;
    }
  }

  // Restar dinero del bolsillo (por servidor)
  static async subtractPocket(
    userId: string,
    guildId: string,
    amount: number,
    username: string,
    guild: Guild,
  ) {
    try {
      const user = await prisma.userEconomy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          pocket: { decrement: amount },
          totalLost: { increment: amount },
        },
      });

      // Actualizar leaderboard
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      return user;
    } catch (error) {
      logger.error("Error subtracting from pocket:", error);
      throw error;
    }
  }

  // Transferir dinero entre usuarios (en el mismo servidor)
  static async transfer(
    fromUserId: string,
    toUserId: string,
    guildId: string,
    amount: number,
    fromUsername: string,
    toUsername: string,
    guild: Guild,
  ) {
    try {
      await prisma.$transaction([
        prisma.userEconomy.update({
          where: {
            userId_guildId: {
              userId: fromUserId,
              guildId,
            },
          },
          data: {
            pocket: { decrement: amount },
            totalLost: { increment: amount },
          },
        }),
        prisma.userEconomy.update({
          where: {
            userId_guildId: {
              userId: toUserId,
              guildId,
            },
          },
          data: {
            pocket: { increment: amount },
            totalEarned: { increment: amount },
          },
        }),
      ]);

      // Actualizar leaderboard para ambos usuarios
      await Promise.all([
        LeaderboardService.updateLeaderboard(
          fromUserId,
          guildId,
          fromUsername,
          guild,
        ),
        LeaderboardService.updateLeaderboard(
          toUserId,
          guildId,
          toUsername,
          guild,
        ),
      ]);

      logger.info(
        `Transferred ${amount} from ${fromUserId} to ${toUserId} in guild ${guildId}`,
      );
    } catch (error) {
      logger.error("Error transferring money:", error);
      throw error;
    }
  }

  // Obtener balance del usuario (bolsillo del servidor + banco global)
  static async getBalance(userId: string, guildId: string) {
    try {
      const user = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      const globalBank = await prisma.globalBank.findUnique({
        where: { userId },
      });

      const pocket = user?.pocket || 0;
      const bank = globalBank?.bank || 0;

      return {
        pocket,
        bank,
        total: pocket + bank,
      };
    } catch (error) {
      logger.error("Error getting balance:", error);
      throw error;
    }
  }

  // Verificar cooldown (por servidor)
  static async checkCooldown(
    userId: string,
    guildId: string,
    type: "work" | "crime" | "rob",
  ): Promise<{ onCooldown: boolean; remainingTime?: number }> {
    try {
      const user = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!user) return { onCooldown: false };

      // Obtener cooldown de la configuración del servidor
      const cooldownTime = await EconomyConfigService.getCooldown(
        guildId,
        type,
      );

      const lastUsed =
        type === "work"
          ? user.lastWork
          : type === "crime"
            ? user.lastCrime
            : user.lastRob;

      if (!lastUsed) return { onCooldown: false };

      const timeSinceLastUse = Date.now() - lastUsed.getTime();

      if (timeSinceLastUse < cooldownTime) {
        const remainingTime = cooldownTime - timeSinceLastUse;
        return { onCooldown: true, remainingTime };
      }

      return { onCooldown: false };
    } catch (error) {
      logger.error("Error checking cooldown:", error);
      return { onCooldown: false };
    }
  }

  // Actualizar cooldown (por servidor)
  static async updateCooldown(
    userId: string,
    guildId: string,
    type: "work" | "crime" | "rob",
  ) {
    try {
      const updateData: any = {};
      if (type === "work") updateData.lastWork = new Date();
      if (type === "crime") updateData.lastCrime = new Date();
      if (type === "rob") updateData.lastRob = new Date();

      await prisma.userEconomy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: updateData,
      });
    } catch (error) {
      logger.error("Error updating cooldown:", error);
      throw error;
    }
  }

  // Depositar en el banco (del bolsillo del servidor al banco global)
  static async deposit(
    userId: string,
    guildId: string,
    username: string,
    amount: number,
    guild: Guild,
  ) {
    try {
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

      // Asegurar que existe el banco global
      await this.getOrCreateGlobalBank(userId, username);

      // Transacción: sacar del bolsillo local y meter al banco global
      await prisma.$transaction([
        prisma.userEconomy.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            pocket: { decrement: amount },
          },
        }),
        prisma.globalBank.update({
          where: { userId },
          data: {
            bank: { increment: amount },
          },
        }),
      ]);

      // Actualizar leaderboard (el dinero total no cambia, pero mantener sincronizado)
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      logger.info(
        `User ${userId} deposited ${amount} to global bank from guild ${guildId}`,
      );
    } catch (error) {
      logger.error("Error depositing to bank:", error);
      throw error;
    }
  }

  // Retirar del banco (del banco global al bolsillo del servidor)
  static async withdraw(
    userId: string,
    guildId: string,
    username: string,
    amount: number,
    guild: Guild,
  ) {
    try {
      const globalBank = await prisma.globalBank.findUnique({
        where: { userId },
      });

      if (!globalBank || globalBank.bank < amount) {
        throw new Error("Fondos insuficientes en el banco");
      }

      // Asegurar que existe el usuario en este servidor
      await this.getOrCreateUser(userId, username, guildId);

      // Transacción: sacar del banco global y meter al bolsillo local
      await prisma.$transaction([
        prisma.globalBank.update({
          where: { userId },
          data: {
            bank: { decrement: amount },
          },
        }),
        prisma.userEconomy.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            pocket: { increment: amount },
          },
        }),
      ]);

      // Actualizar leaderboard (el dinero total no cambia, pero mantener sincronizado)
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      logger.info(
        `User ${userId} withdrew ${amount} from global bank to guild ${guildId}`,
      );
    } catch (error) {
      logger.error("Error withdrawing from bank:", error);
      throw error;
    }
  }

  // Obtener estadísticas del usuario en un servidor
  static async getStats(userId: string, guildId: string) {
    try {
      const user = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!user) {
        return {
          totalEarned: 0,
          totalLost: 0,
          netProfit: 0,
        };
      }

      return {
        totalEarned: user.totalEarned,
        totalLost: user.totalLost,
        netProfit: user.totalEarned - user.totalLost,
      };
    } catch (error) {
      logger.error("Error getting stats:", error);
      throw error;
    }
  }
}
