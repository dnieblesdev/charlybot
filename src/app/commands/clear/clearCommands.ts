import { REST, Routes } from "discord.js";
import logger from "../../../utils/logger.ts";

async function clearCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId1 = process.env.GUILD_ID;
  const guildId2 = process.env.GUILD_ID2;

  if (!token || !clientId) {
    logger.error("Missing required environment variables", {
      context: "clearCommands",
      hasToken: !!token,
      hasClientId: !!clientId,
    });
    throw new Error("❌ Faltan DISCORD_TOKEN o CLIENT_ID en .env");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    logger.info("Starting command cleanup", {
      context: "clearCommands",
    });
    console.log("🧹 Limpiando comandos...\n");

    // Limpiar comandos de los servidores principales
    const mainGuilds = [guildId1, guildId2].filter(Boolean);

    if (mainGuilds.length > 0) {
      logger.info("Clearing commands from main guilds", {
        context: "clearCommands",
        guildCount: mainGuilds.length,
      });
      console.log("📍 Limpiando servidores principales:");

      for (const guildId of mainGuilds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guildId!), {
            body: [],
          });
          logger.info("Guild commands cleared", {
            context: "clearCommands",
            guildId: guildId,
          });
          console.log(`   ✅ Servidor ${guildId}: Comandos limpiados`);
        } catch (error) {
          logger.error("Error clearing guild commands", {
            error: error instanceof Error ? error.message : String(error),
            context: "clearCommands",
            guildId: guildId,
          });
          console.error(`   ❌ Error en servidor ${guildId}:`, error);
        }
      }
    }

    // Limpiar comandos globales
    logger.info("Clearing global commands", {
      context: "clearCommands",
    });
    console.log("\n🌍 Limpiando comandos globales...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: [],
    });
    logger.info("Global commands cleared successfully", {
      context: "clearCommands",
    });
    console.log("   ✅ Comandos globales limpiados");

    logger.info("Command cleanup completed successfully", {
      context: "clearCommands",
    });
    console.log("\n✅ Todos los comandos eliminados exitosamente!");
  } catch (error) {
    logger.error("Fatal error clearing commands", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: "clearCommands",
    });
    console.error("❌ Error limpiando comandos:", error);
  }
}

clearCommands();
