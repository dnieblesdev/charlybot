import { Client, GatewayIntentBits } from "discord.js";
import { prisma } from "../src/infrastructure/storage/prismaClient.js";
import logger from "../src/utils/logger.js";

interface MigrationResult {
  guildId: string;
  guildName: string;
  success: number;
  failed: number;
  total: number;
}

async function initializeLeaderboard() {
  logger.info("🚀 Iniciando migración del leaderboard...");

  // Crear cliente de Discord
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  try {
    // Login con el token
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      logger.error(
        "❌ DISCORD_TOKEN no encontrado en las variables de entorno",
      );
      throw new Error("DISCORD_TOKEN no encontrado");
    }

    logger.info("🔐 Conectando con Discord...");
    await client.login(token);
    logger.info("✅ Conectado exitosamente");

    // Obtener todos los servidores únicos de la tabla UserEconomy
    const guilds = await prisma.userEconomy.findMany({
      select: {
        guildId: true,
      },
      distinct: ["guildId"],
    });

    logger.info(
      `📊 Servidores encontrados con usuarios de economía: ${guilds.length}`,
    );

    if (guilds.length === 0) {
      logger.warn(
        "⚠️  No hay servidores con usuarios de economía para migrar.",
      );
      await client.destroy();
      await prisma.$disconnect();
      return;
    }

    const results: MigrationResult[] = [];

    // Procesar cada servidor
    for (const { guildId } of guilds) {
      try {
        logger.info(`\n${"=".repeat(60)}`);
        logger.info(`📍 Procesando servidor: ${guildId}`);
        logger.info("=".repeat(60));

        // Obtener el guild de Discord
        const guild = await client.guilds.fetch(guildId).catch(() => null);

        if (!guild) {
          logger.warn(
            `⚠️  No se pudo acceder al servidor ${guildId} (bot no está en el servidor)`,
          );
          results.push({
            guildId,
            guildName: "Desconocido",
            success: 0,
            failed: 0,
            total: 0,
          });
          continue;
        }

        logger.info(`🏢 Servidor: ${guild.name}`);

        // Obtener todos los usuarios con economía en este servidor
        const users = await prisma.userEconomy.findMany({
          where: { guildId },
        });

        logger.info(`👥 Usuarios encontrados: ${users.length}`);

        let success = 0;
        let failed = 0;

        // Procesar cada usuario
        for (const user of users) {
          try {
            // Verificar si ya existe en el leaderboard
            const existingEntry = await prisma.leaderboard.findUnique({
              where: {
                userId_guildId: {
                  userId: user.userId,
                  guildId: user.guildId,
                },
              },
            });

            if (existingEntry) {
              logger.debug(
                `  ⏭️  Usuario ${user.username} (${user.userId}) ya existe en leaderboard, saltando...`,
              );
              success++;
              continue;
            }

            // Obtener banco global
            const globalBank = await prisma.globalBank.findUnique({
              where: { userId: user.userId },
            });

            // Calcular dinero total
            const totalMoney = user.pocket + (globalBank?.bank || 0);

            // Obtener miembro del servidor para fecha de ingreso
            let joinedServerAt: Date;
            try {
              const member = await guild.members.fetch(user.userId);
              joinedServerAt = member.joinedAt || new Date();
              logger.info(
                `  ✅ ${user.username}: $${totalMoney.toFixed(2)} (Ingresó: ${joinedServerAt.toLocaleDateString()})`,
              );
            } catch (error) {
              // Si no se puede obtener el miembro, usar fecha actual
              joinedServerAt = new Date();
              logger.warn(
                `  ⚠️  ${user.username}: $${totalMoney.toFixed(2)} (No se pudo obtener fecha de ingreso, usando fecha actual)`,
              );
            }

            // Crear entrada en el leaderboard
            await prisma.leaderboard.create({
              data: {
                userId: user.userId,
                guildId: user.guildId,
                username: user.username,
                totalMoney,
                joinedServerAt,
              },
            });

            success++;
          } catch (error) {
            failed++;
            logger.error(
              `  ❌ Error procesando usuario ${user.username} (${user.userId}):`,
              {
                error: error instanceof Error ? error.message : String(error),
              },
            );
          }
        }

        results.push({
          guildId,
          guildName: guild.name,
          success,
          failed,
          total: users.length,
        });

        logger.info(
          `\n✅ Servidor completado: ${success}/${users.length} usuarios migrados`,
        );
      } catch (error) {
        logger.error(`❌ Error procesando servidor ${guildId}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          guildId,
          guildName: "Error",
          success: 0,
          failed: 0,
          total: 0,
        });
      }
    }

    // Mostrar resumen final
    logger.info("\n\n" + "=".repeat(60));
    logger.info("📊 RESUMEN DE MIGRACIÓN");
    logger.info("=".repeat(60));

    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalUsers = results.reduce((sum, r) => sum + r.total, 0);

    logger.info("\n🏢 Por Servidor:\n");
    results.forEach((result) => {
      const percentage =
        result.total > 0
          ? ((result.success / result.total) * 100).toFixed(1)
          : "0.0";
      logger.info(`  ${result.guildName} (${result.guildId})`);
      logger.info(
        `    ✅ Éxito: ${result.success}/${result.total} (${percentage}%)`,
      );
      if (result.failed > 0) {
        logger.info(`    ❌ Fallos: ${result.failed}`);
      }
      logger.info("");
    });

    logger.info("📈 Total General:");
    logger.info(`  👥 Usuarios procesados: ${totalUsers}`);
    logger.info(`  ✅ Migrados exitosamente: ${totalSuccess}`);
    logger.info(`  ❌ Fallos: ${totalFailed}`);
    logger.info(
      `  📊 Tasa de éxito: ${totalUsers > 0 ? ((totalSuccess / totalUsers) * 100).toFixed(1) : "0.0"}%`,
    );

    logger.info("\n" + "=".repeat(60));
    logger.info("✅ Migración completada!");
    logger.info("=".repeat(60));

    logger.info("Migración de leaderboard completada", {
      totalUsers,
      totalSuccess,
      totalFailed,
      guilds: results.length,
    });
  } catch (error) {
    logger.error("\n❌ Error fatal durante la migración:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.error("Error fatal en migración de leaderboard", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    // Limpiar conexiones
    await client.destroy();
    await prisma.$disconnect();
  }
}

// Ejecutar el script
logger.info("🎯 Script de Inicialización del Leaderboard");
logger.info("=".repeat(60));
logger.info(
  "Este script migrará todos los usuarios de economía al leaderboard",
);
logger.info("por servidor, calculando su dinero total y obteniendo su fecha");
logger.info("de ingreso al servidor desde Discord.\n");

initializeLeaderboard().catch((error) => {
  logger.error("❌ Error ejecutando script:", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
