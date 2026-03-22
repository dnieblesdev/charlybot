import { Guild } from "discord.js";
import logger from "../../../utils/logger.js";
import * as EconomyRepo from "../../../config/repositories/EconomyRepo";

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
      const userEconomy = await EconomyRepo.getEconomyUser(guildId, userId);

      if (!userEconomy) {
        logger.warn("No se encontró usuario para actualizar leaderboard via API", {
          userId,
          guildId,
        });
        return;
      }

      // Calcular ganancia neta (por servidor)
      const netProfit = userEconomy.totalEarned - userEconomy.totalLost;

      // 2. Verificar si ya existe el registro
      const existingRecord = await EconomyRepo.getLeaderboardEntry(guildId, userId);

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

      // 4. Actualizar o crear registro via API
      await EconomyRepo.upsertLeaderboard(guildId, {
        userId,
        guildId,
        username,
        totalMoney: netProfit,
        joinedServerAt: existingRecord ? undefined : (joinedServerAt || new Date()),
        updatedAt: new Date(),
      });

      logger.debug("Leaderboard actualizado para usuario via API", {
        userId,
        guildId,
        username,
        netProfit,
      });
    } catch (error) {
      logger.error("Error al actualizar leaderboard via API", {
        userId,
        guildId,
        error: error instanceof Error ? error.message : String(error),
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
      const leaderboard = await EconomyRepo.getLeaderboard(guildId, limit);

      // Asignar posiciones
      return leaderboard.map((entry: any, index: number) => ({
        position: index + 1,
        userId: entry.userId,
        username: entry.username,
        netProfit: entry.totalMoney, // Ahora representa netProfit (ganancia neta del servidor)
        joinedServerAt: new Date(entry.joinedServerAt),
      }));
    } catch (error) {
      logger.error("Error al obtener leaderboard via API", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
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
      return await EconomyRepo.getUserPosition(guildId, userId);
    } catch (error) {
      logger.error("Error al obtener posición de usuario en leaderboard via API", {
        userId,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Inicializar leaderboard con usuarios existentes (migración inicial)
   */
  static async initializeLeaderboard(
    guildId: string,
    guild: Guild,
  ): Promise<{ success: number; failed: number }> {
    // This one is tricky because it involves getting all users.
    // We don't have a getAllUsers endpoint yet.
    // For now, we skip it or assume it's done during manual migration.
    logger.warn("initializeLeaderboard is not fully implemented in API-only mode.");
    return { success: 0, failed: 0 };
  }

  /**
   * Eliminar entrada del leaderboard para un usuario
   */
  static async removeFromLeaderboard(
    userId: string,
    guildId: string,
  ): Promise<void> {
    try {
      await EconomyRepo.removeFromLeaderboard(guildId, userId);
      logger.debug("Usuario eliminado del leaderboard via API", {
        userId,
        guildId,
      });
    } catch (error) {
      logger.error("Error al eliminar usuario del leaderboard via API", {
        userId,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default LeaderboardService;
