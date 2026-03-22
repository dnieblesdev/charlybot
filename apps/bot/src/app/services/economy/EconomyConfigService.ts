import logger from "../../../utils/logger.js";
import * as EconomyRepo from "../../../config/repositories/EconomyRepo";

export class EconomyConfigService {
  // Obtener o crear configuración de economía para un servidor
  static async getOrCreateConfig(guildId: string) {
    try {
      let config = await EconomyRepo.getEconomyConfig(guildId);

      if (!config) {
        config = await EconomyRepo.createEconomyConfig(guildId, {
          guildId,
          workCooldown: 300000,
          crimeCooldown: 900000,
          robCooldown: 1800000,
          workMinAmount: 100,
          workMaxAmount: 300,
          crimeMultiplier: 3,
          startingMoney: 1000,
          jailTimeWork: 30,
          jailTimeRob: 45,
          rouletteChannelId: null,
        });
        logger.info(`Created economy config for guild ${guildId} via API`);
      }

      return config;
    } catch (error) {
      logger.error("Error getting or creating economy config via API:", error);
      throw error;
    }
  }

  // Actualizar cooldown de work
  static async updateWorkCooldown(guildId: string, minutes: number) {
    try {
      const milliseconds = minutes * 60 * 1000;
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        workCooldown: milliseconds,
      });

      logger.info(
        `Updated work cooldown for guild ${guildId} to ${minutes} minutes via API`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating work cooldown via API:", error);
      throw error;
    }
  }

  // Actualizar cooldown de crime
  static async updateCrimeCooldown(guildId: string, minutes: number) {
    try {
      const milliseconds = minutes * 60 * 1000;
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        crimeCooldown: milliseconds,
      });

      logger.info(
        `Updated crime cooldown for guild ${guildId} to ${minutes} minutes via API`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating crime cooldown via API:", error);
      throw error;
    }
  }

  // Actualizar cooldown de rob
  static async updateRobCooldown(guildId: string, minutes: number) {
    try {
      const milliseconds = minutes * 60 * 1000;
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        robCooldown: milliseconds,
      });

      logger.info(
        `Updated rob cooldown for guild ${guildId} to ${minutes} minutes via API`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating rob cooldown via API:", error);
      throw error;
    }
  }

  // Actualizar rango de ganancias de work
  static async updateWorkAmounts(
    guildId: string,
    minAmount: number,
    maxAmount: number,
  ) {
    try {
      if (minAmount > maxAmount) {
        throw new Error("El mínimo no puede ser mayor que el máximo");
      }

      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        workMinAmount: minAmount,
        workMaxAmount: maxAmount,
      });

      logger.info(
        `Updated work amounts for guild ${guildId}: $${minAmount}-$${maxAmount} via API`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating work amounts via API:", error);
      throw error;
    }
  }

  // Actualizar multiplicador de crime
  static async updateCrimeMultiplier(guildId: string, multiplier: number) {
    try {
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        crimeMultiplier: multiplier,
      });

      logger.info(
        `Updated crime multiplier for guild ${guildId} to x${multiplier} via API`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating crime multiplier via API:", error);
      throw error;
    }
  }

  // Actualizar dinero inicial
  static async updateStartingMoney(guildId: string, amount: number) {
    try {
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        startingMoney: amount,
      });

      logger.info(`Updated starting money for guild ${guildId} to $${amount} via API`);
      return config;
    } catch (error) {
      logger.error("Error updating starting money via API:", error);
      throw error;
    }
  }

  // Actualizar tiempos de prisión
  static async updateJailTimes(
    guildId: string,
    workJailTime?: number,
    robJailTime?: number,
  ) {
    try {
      const updateData: any = {};
      if (workJailTime !== undefined) updateData.jailTimeWork = workJailTime;
      if (robJailTime !== undefined) updateData.jailTimeRob = robJailTime;

      const config = await EconomyRepo.updateEconomyConfig(guildId, updateData);

      logger.info(`Updated jail times for guild ${guildId} via API`);
      return config;
    } catch (error) {
      logger.error("Error updating jail times via API:", error);
      throw error;
    }
  }

  // Actualizar canal de ruleta
  static async updateRouletteChannel(
    guildId: string,
    channelId: string | null,
  ) {
    try {
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        rouletteChannelId: channelId,
      });

      if (channelId) {
        logger.info(
          `Set roulette channel for guild ${guildId} to ${channelId} via API`,
        );
      } else {
        logger.info(
          `Removed roulette channel restriction for guild ${guildId} via API`,
        );
      }
      return config;
    } catch (error) {
      logger.error("Error updating roulette channel via API:", error);
      throw error;
    }
  }

  // Resetear configuración a valores por defecto
  static async resetConfig(guildId: string) {
    try {
      const config = await EconomyRepo.updateEconomyConfig(guildId, {
        workCooldown: 300000, // 5 minutos
        crimeCooldown: 900000, // 15 minutos
        robCooldown: 1800000, // 30 minutos
        workMinAmount: 100,
        workMaxAmount: 300,
        crimeMultiplier: 3,
        startingMoney: 1000,
        jailTimeWork: 30,
        jailTimeRob: 45,
        rouletteChannelId: null,
      });

      logger.info(`Reset economy config for guild ${guildId} via API`);
      return config;
    } catch (error) {
      logger.error("Error resetting config via API:", error);
      throw error;
    }
  }

  // Obtener cooldown en milisegundos
  static async getCooldown(
    guildId: string,
    type: "work" | "crime" | "rob",
  ): Promise<number> {
    try {
      const config = await this.getOrCreateConfig(guildId);

      switch (type) {
        case "work":
          return config.workCooldown;
        case "crime":
          return config.crimeCooldown;
        case "rob":
          return config.robCooldown;
        default:
          return 300000; // 5 minutos por defecto
      }
    } catch (error) {
      logger.error("Error getting cooldown via API:", error);
      const defaults = {
        work: 300000,
        crime: 900000,
        rob: 1800000,
      };
      return defaults[type];
    }
  }
}
