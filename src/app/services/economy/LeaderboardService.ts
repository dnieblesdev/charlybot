import { Guild } from "discord.js";
import { prisma } from "../../../infrastructure/storage/prismaClient.js";
import logger from "../../../utils/logger.js";

class LeaderboardService {
  /**
   * Actualizar o crear entrada en el leaderboard para un usuario
   */
  static async updateLeaderboard(
    userId: string,
    guildId: string,
    username: string,
    guild: Guild,
  ): Promise<void> {
    try {
      // 1. Obtener estadísticas del usuario en este servidor (totalEarned - totalLost)
      const userEconomy = await prisma.userEconomy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!userEconomy) {
        logger.warn("No se encontró usuario para actualizar leaderboard", {
          userId,
          guildId,
        });
        return;
      }

      // Calcular ganancia neta (por servidor)
      const netProfit = userEconomy.totalEarned - userEconomy.totalLost;

      // 2. Verificar si ya existe el registro
      const existingRecord = await prisma.leaderboard.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      // 3. Si no existe, obtener joinedAt de Discord
      let joinedServerAt: Date | null = null;
      if (!existingRecord) {
        try {
          const member = await guild.members.fetch(userId);
          joinedServerAt = member.joinedAt || new Date();
        } catch (error) {
          logger.warn(
            "No se pudo obtener fecha de ingreso del servidor para usuario",
            {
              userId,
              guildId,
              error: error instanceof Error ? error.message : String(error),
            },
          );
          joinedServerAt = new Date(); // Fecha actual como fallback
        }
      }

      // 4. Actualizar o crear registro
      await prisma.leaderboard.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        update: {
          totalMoney: netProfit, // Ahora representa netProfit (ganancia neta del servidor)
          username,
          updatedAt: new Date(),
        },
        create: {
          userId,
          guildId,
          username,
          totalMoney: netProfit, // Ahora representa netProfit (ganancia neta del servidor)
          joinedServerAt: joinedServerAt || new Date(),
        },
      });

      logger.debug("Leaderboard actualizado para usuario", {
        userId,
        guildId,
        username,
        netProfit,
      });
    } catch (error) {
      logger.error("Error al actualizar leaderboard", {
        userId,
        guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Obtener el leaderboard de un servidor
   */
  static async getLeaderboard(
    guildId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      position: number;
      userId: string;
      username: string;
      netProfit: number;
      joinedServerAt: Date;
    }>
  > {
    try {
      const leaderboard = await prisma.leaderboard.findMany({
        where: { guildId },
        orderBy: [
          { totalMoney: "desc" }, // Por ganancia neta descendente
          { joinedServerAt: "asc" }, // Por antigüedad ascendente (desempate)
        ],
        take: limit,
      });

      // Asignar posiciones
      return leaderboard.map((entry: any, index: number) => ({
        position: index + 1,
        userId: entry.userId,
        username: entry.username,
        netProfit: entry.totalMoney, // Ahora representa netProfit (ganancia neta del servidor)
        joinedServerAt: entry.joinedServerAt,
      }));
    } catch (error) {
      logger.error("Error al obtener leaderboard", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Obtener la posición de un usuario específico en el leaderboard
   */
  static async getUserPosition(
    userId: string,
    guildId: string,
  ): Promise<number | null> {
    try {
      const userEntry = await prisma.leaderboard.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      if (!userEntry) {
        return null;
      }

      // Contar cuántos usuarios tienen más ganancia neta
      // o misma ganancia pero se unieron antes
      const usersAhead = await prisma.leaderboard.count({
        where: {
          guildId,
          OR: [
            { totalMoney: { gt: userEntry.totalMoney } },
            {
              totalMoney: userEntry.totalMoney,
              joinedServerAt: { lt: userEntry.joinedServerAt },
            },
          ],
        },
      });

      return usersAhead + 1; // Posición es el número de usuarios adelante + 1
    } catch (error) {
      logger.error("Error al obtener posición de usuario en leaderboard", {
        userId,
        guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Inicializar leaderboard con usuarios existentes (migración inicial)
   * Ejecutar UNA sola vez después de crear la tabla
   */
  static async initializeLeaderboard(
    guildId: string,
    guild: Guild,
  ): Promise<{ success: number; failed: number }> {
    try {
      logger.info("Iniciando migración de usuarios al leaderboard", {
        guildId,
      });

      const users = await prisma.userEconomy.findMany({
        where: { guildId },
      });

      let success = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await this.updateLeaderboard(
            user.userId,
            guildId,
            user.username,
            guild,
          );
          success++;
        } catch (error) {
          failed++;
          logger.error("Error al migrar usuario al leaderboard", {
            userId: user.userId,
            guildId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info("Migración de leaderboard completada", {
        guildId,
        success,
        failed,
        total: users.length,
      });

      return { success, failed };
    } catch (error) {
      logger.error("Error al inicializar leaderboard", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Eliminar entrada del leaderboard para un usuario
   */
  static async removeFromLeaderboard(
    userId: string,
    guildId: string,
  ): Promise<void> {
    try {
      await prisma.leaderboard.delete({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      logger.debug("Usuario eliminado del leaderboard", {
        userId,
        guildId,
      });
    } catch (error) {
      // No hacer nada si no existe
      if (
        error instanceof Error &&
        error.message.includes("Record to delete does not exist")
      ) {
        return;
      }

      logger.error("Error al eliminar usuario del leaderboard", {
        userId,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default LeaderboardService;
