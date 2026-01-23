import { prisma } from "../../../infrastructure/storage/prismaClient.js";
import logger from "../../../utils/logger.js";

export class EconomyConfigService {
  // Obtener o crear configuración de economía para un servidor
  static async getOrCreateConfig(guildId: string) {
    try {
      let config = await prisma.economyConfig.findUnique({
        where: { guildId },
      });

      if (!config) {
        config = await prisma.economyConfig.create({
          data: {
            guildId,
            // Los valores por defecto están en el schema
          },
        });
        logger.info(`Created economy config for guild ${guildId}`);
      }

      return config;
    } catch (error) {
      logger.error("Error getting or creating economy config:", error);
      throw error;
    }
  }

  // Actualizar cooldown de work
  static async updateWorkCooldown(guildId: string, minutes: number) {
    try {
      const milliseconds = minutes * 60 * 1000;
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: { workCooldown: milliseconds },
        create: {
          guildId,
          workCooldown: milliseconds,
        },
      });

      logger.info(
        `Updated work cooldown for guild ${guildId} to ${minutes} minutes`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating work cooldown:", error);
      throw error;
    }
  }

  // Actualizar cooldown de crime
  static async updateCrimeCooldown(guildId: string, minutes: number) {
    try {
      const milliseconds = minutes * 60 * 1000;
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: { crimeCooldown: milliseconds },
        create: {
          guildId,
          crimeCooldown: milliseconds,
        },
      });

      logger.info(
        `Updated crime cooldown for guild ${guildId} to ${minutes} minutes`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating crime cooldown:", error);
      throw error;
    }
  }

  // Actualizar cooldown de rob
  static async updateRobCooldown(guildId: string, minutes: number) {
    try {
      const milliseconds = minutes * 60 * 1000;
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: { robCooldown: milliseconds },
        create: {
          guildId,
          robCooldown: milliseconds,
        },
      });

      logger.info(
        `Updated rob cooldown for guild ${guildId} to ${minutes} minutes`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating rob cooldown:", error);
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

      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: {
          workMinAmount: minAmount,
          workMaxAmount: maxAmount,
        },
        create: {
          guildId,
          workMinAmount: minAmount,
          workMaxAmount: maxAmount,
        },
      });

      logger.info(
        `Updated work amounts for guild ${guildId}: $${minAmount}-$${maxAmount}`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating work amounts:", error);
      throw error;
    }
  }

  // Actualizar multiplicador de crime
  static async updateCrimeMultiplier(guildId: string, multiplier: number) {
    try {
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: { crimeMultiplier: multiplier },
        create: {
          guildId,
          crimeMultiplier: multiplier,
        },
      });

      logger.info(
        `Updated crime multiplier for guild ${guildId} to x${multiplier}`,
      );
      return config;
    } catch (error) {
      logger.error("Error updating crime multiplier:", error);
      throw error;
    }
  }

  // Actualizar dinero inicial
  static async updateStartingMoney(guildId: string, amount: number) {
    try {
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: { startingMoney: amount },
        create: {
          guildId,
          startingMoney: amount,
        },
      });

      logger.info(`Updated starting money for guild ${guildId} to $${amount}`);
      return config;
    } catch (error) {
      logger.error("Error updating starting money:", error);
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

      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: updateData,
        create: {
          guildId,
          ...updateData,
        },
      });

      logger.info(`Updated jail times for guild ${guildId}`);
      return config;
    } catch (error) {
      logger.error("Error updating jail times:", error);
      throw error;
    }
  }

  // Actualizar canal de ruleta
  static async updateRouletteChannel(
    guildId: string,
    channelId: string | null,
  ) {
    try {
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: { rouletteChannelId: channelId },
        create: {
          guildId,
          rouletteChannelId: channelId,
        },
      });

      if (channelId) {
        logger.info(
          `Set roulette channel for guild ${guildId} to ${channelId}`,
        );
      } else {
        logger.info(
          `Removed roulette channel restriction for guild ${guildId}`,
        );
      }
      return config;
    } catch (error) {
      logger.error("Error updating roulette channel:", error);
      throw error;
    }
  }

  // Resetear configuración a valores por defecto
  static async resetConfig(guildId: string) {
    try {
      const config = await prisma.economyConfig.upsert({
        where: { guildId },
        update: {
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
        },
        create: {
          guildId,
        },
      });

      logger.info(`Reset economy config for guild ${guildId}`);
      return config;
    } catch (error) {
      logger.error("Error resetting config:", error);
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
      logger.error("Error getting cooldown:", error);
      // Valores por defecto si hay error
      const defaults = {
        work: 300000,
        crime: 900000,
        rob: 1800000,
      };
      return defaults[type];
    }
  }
}
