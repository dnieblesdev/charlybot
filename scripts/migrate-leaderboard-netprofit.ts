import { prisma } from "../src/infrastructure/storage/prismaClient.js";

/**
 * Script de migración para actualizar el leaderboard
 * De usar totalMoney (pocket + bank) a netProfit (totalEarned - totalLost)
 *
 * Este script recalcula todos los valores del leaderboard basándose en
 * las estadísticas reales de cada usuario por servidor.
 */
async function migrateLeaderboardToNetProfit() {
  console.log("🚀 Iniciando migración del leaderboard a netProfit...\n");

  try {
    // Obtener todos los registros del leaderboard
    const leaderboardEntries = await prisma.leaderboard.findMany({});

    console.log(
      `📊 Encontrados ${leaderboardEntries.length} registros en el leaderboard\n`,
    );

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of leaderboardEntries) {
      try {
        // Buscar las estadísticas del usuario en el servidor
        const userEconomy = await prisma.userEconomy.findUnique({
          where: {
            userId_guildId: {
              userId: entry.userId,
              guildId: entry.guildId,
            },
          },
        });

        if (!userEconomy) {
          console.log(
            `⚠️  Usuario no encontrado: ${entry.username} (${entry.userId}) en guild ${entry.guildId}`,
          );
          skipped++;
          continue;
        }

        // Calcular ganancia neta
        const netProfit = userEconomy.totalEarned - userEconomy.totalLost;
        const oldValue = entry.totalMoney;

        // Actualizar el registro
        await prisma.leaderboard.update({
          where: {
            userId_guildId: {
              userId: entry.userId,
              guildId: entry.guildId,
            },
          },
          data: {
            totalMoney: netProfit,
            updatedAt: new Date(),
          },
        });

        console.log(
          `✅ ${entry.username}: $${oldValue.toFixed(2)} → $${netProfit.toFixed(2)} (Δ: ${(netProfit - oldValue).toFixed(2)})`,
        );
        updated++;
      } catch (error) {
        console.error(
          `❌ Error procesando ${entry.username} (${entry.userId}):`,
          error instanceof Error ? error.message : String(error),
        );
        errors++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📈 Resumen de la migración:");
    console.log("=".repeat(60));
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⚠️  Omitidos: ${skipped}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total: ${leaderboardEntries.length}`);
    console.log("=".repeat(60));

    if (updated > 0) {
      console.log("\n✨ Migración completada exitosamente!");
      console.log(
        "💡 El leaderboard ahora muestra la ganancia neta (totalEarned - totalLost) por servidor.",
      );
    } else {
      console.log("\n⚠️  No se actualizó ningún registro.");
    }
  } catch (error) {
    console.error("\n❌ Error fatal durante la migración:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
migrateLeaderboardToNetProfit()
  .then(() => {
    console.log("\n👋 Proceso finalizado.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Error inesperado:", error);
    process.exit(1);
  });
