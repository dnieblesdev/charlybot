import { REST, Routes } from "discord.js";
import logger from "../../../utils/logger.ts";

async function listRegisteredCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId1 = process.env.GUILD_ID;
  const guildId2 = process.env.GUILD_ID2;

  if (!token || !clientId) {
    logger.error("Missing required environment variables", {
      context: "listRegistered",
      hasToken: !!token,
      hasClientId: !!clientId,
    });
    throw new Error("❌ Faltan DISCORD_TOKEN o CLIENT_ID en .env");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    logger.info("Starting to list registered commands", {
      context: "listRegistered",
    });
    console.log("🔍 Listando comandos registrados...\n");

    // Listar comandos de los servidores principales
    const mainGuilds = [guildId1, guildId2].filter(Boolean);

    if (mainGuilds.length > 0) {
      logger.info("Listing commands for main guilds", {
        context: "listRegistered",
        guildCount: mainGuilds.length,
      });
      console.log("📍 Comandos en servidores principales:");

      for (const guildId of mainGuilds) {
        try {
          const commands = (await rest.get(
            Routes.applicationGuildCommands(clientId, guildId!),
          )) as any[];

          logger.info("Guild commands retrieved", {
            context: "listRegistered",
            guildId: guildId,
            commandCount: commands.length,
          });

          console.log(`\n   Servidor ${guildId}:`);
          if (commands.length === 0) {
            console.log("   ⚠️  Sin comandos registrados");
          } else {
            commands.forEach((cmd, index) => {
              console.log(`   ${index + 1}. /${cmd.name} - ${cmd.description}`);
            });
          }
        } catch (error) {
          logger.error("Error retrieving guild commands", {
            error: error instanceof Error ? error.message : String(error),
            context: "listRegistered",
            guildId: guildId,
          });
          console.error(`   ❌ Error en servidor ${guildId}:`, error);
        }
      }
    }

    // Listar comandos globales
    logger.info("Listing global commands", {
      context: "listRegistered",
    });
    console.log("\n🌍 Comandos globales:");
    const globalCommands = (await rest.get(
      Routes.applicationCommands(clientId),
    )) as any[];

    logger.info("Global commands retrieved", {
      context: "listRegistered",
      commandCount: globalCommands.length,
    });

    if (globalCommands.length === 0) {
      console.log("   ⚠️  Sin comandos registrados");
    } else {
      globalCommands.forEach((cmd, index) => {
        console.log(`   ${index + 1}. /${cmd.name} - ${cmd.description}`);
      });
    }

    logger.info("Command listing completed successfully", {
      context: "listRegistered",
    });
    console.log("\n✅ Listado completado");
  } catch (error) {
    logger.error("Fatal error listing commands", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: "listRegistered",
    });
    console.error("❌ Error listando comandos:", error);
  }
}

listRegisteredCommands();
