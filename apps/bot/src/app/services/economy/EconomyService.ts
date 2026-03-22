import logger from "../../../utils/logger.js";
import { EconomyConfigService } from "./EconomyConfigService.js";
import LeaderboardService from "./LeaderboardService.js";
import { Guild } from "discord.js";
import * as EconomyRepo from "../../../config/repositories/EconomyRepo";

export class EconomyService {
  // Obtener o crear usuario en la economía (por servidor)
  static async getOrCreateUser(
    userId: string,
    username: string,
    guildId: string,
  ) {
    try {
      let user = await EconomyRepo.getEconomyUser(guildId, userId);

      if (!user) {
        // Obtener dinero inicial de la configuración del servidor
        const config = await EconomyConfigService.getOrCreateConfig(guildId);
        const startingMoney = config.startingMoney;

        user = await EconomyRepo.createEconomyUser(guildId, {
          userId,
          guildId,
          username,
          pocket: startingMoney,
          totalEarned: 0,
          totalLost: 0,
          inJail: false,
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
  static async getOrCreateGlobalBank(guildId: string, userId: string, username: string) {
    try {
      let bank = await EconomyRepo.getGlobalBank(guildId, userId);

      if (!bank) {
        bank = await EconomyRepo.createGlobalBank(guildId, {
          userId,
          username,
          bank: 0,
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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);

      if (!user) return false;

      if (user.inJail && user.jailReleaseAt) {
        // Verificar si ya cumplió su condena
        const releaseAt = new Date(user.jailReleaseAt);
        if (new Date() >= releaseAt) {
          await EconomyRepo.updateEconomyUser(guildId, userId, {
            inJail: false,
            jailReleaseAt: null,
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

      await EconomyRepo.updateEconomyUser(guildId, userId, {
        inJail: true,
        jailReleaseAt: releaseTime,
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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);
      if (!user) throw new Error("User not found");

      const updatedUser = await EconomyRepo.updateEconomyUser(guildId, userId, {
        pocket: user.pocket + amount,
        totalEarned: user.totalEarned + amount,
      });

      // Actualizar leaderboard
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      return updatedUser;
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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);
      if (!user) throw new Error("User not found");

      const updatedUser = await EconomyRepo.updateEconomyUser(guildId, userId, {
        pocket: user.pocket - amount,
        totalLost: user.totalLost + amount,
      });

      // Actualizar leaderboard
      await LeaderboardService.updateLeaderboard(
        userId,
        guildId,
        username,
        guild,
      );

      return updatedUser;
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
      const fromUser = await EconomyRepo.getEconomyUser(guildId, fromUserId);
      const toUser = await EconomyRepo.getEconomyUser(guildId, toUserId);

      if (!fromUser || !toUser) throw new Error("One or both users not found");

      // Note: Transaction is not supported directly via individual repo calls in this simplified version.
      // In a real app, the API should have a /transfer endpoint to ensure atomicity.
      // For now, we do sequential updates.
      await EconomyRepo.updateEconomyUser(guildId, fromUserId, {
        pocket: fromUser.pocket - amount,
        totalLost: fromUser.totalLost + amount,
      });

      await EconomyRepo.updateEconomyUser(guildId, toUserId, {
        pocket: toUser.pocket + amount,
        totalEarned: toUser.totalEarned + amount,
      });

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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);
      const globalBank = await EconomyRepo.getGlobalBank(guildId, userId);

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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);

      if (!user) return { onCooldown: false };

      // Obtener cooldown de la configuración del servidor
      const cooldownTime = await EconomyConfigService.getCooldown(
        guildId,
        type,
      );

      const lastUsedRaw =
        type === "work"
          ? user.lastWork
          : type === "crime"
            ? user.lastCrime
            : user.lastRob;

      if (!lastUsedRaw) return { onCooldown: false };

      const lastUsed = new Date(lastUsedRaw);
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

      await EconomyRepo.updateEconomyUser(guildId, userId, updateData);
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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);
      const globalBank = await EconomyRepo.getGlobalBank(guildId, userId);

      if (!user || user.pocket < amount) {
        throw new Error("Fondos insuficientes en el bolsillo");
      }

      // Asegurar que existe el banco global
      const bank = globalBank || await this.getOrCreateGlobalBank(guildId, userId, username);

      // Again, atomicity should be handled by an API endpoint.
      await EconomyRepo.updateEconomyUser(guildId, userId, {
        pocket: user.pocket - amount,
      });
      
      await EconomyRepo.updateGlobalBank(guildId, userId, {
        bank: bank.bank + amount,
      });

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
      const globalBank = await EconomyRepo.getGlobalBank(guildId, userId);
      const user = await EconomyRepo.getEconomyUser(guildId, userId);

      if (!globalBank || globalBank.bank < amount) {
        throw new Error("Fondos insuficientes en el banco");
      }

      // Asegurar que existe el usuario en este servidor
      const currentUser = user || await this.getOrCreateUser(userId, username, guildId);

      await EconomyRepo.updateGlobalBank(guildId, userId, {
        bank: globalBank.bank - amount,
      });

      await EconomyRepo.updateEconomyUser(guildId, userId, {
        pocket: currentUser.pocket + amount,
      });

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
      const user = await EconomyRepo.getEconomyUser(guildId, userId);

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
