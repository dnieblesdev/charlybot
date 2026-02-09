import { REST, Routes } from "discord.js";
import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../../utils/logger.ts";

// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURACIÓN: Cambia entre DESARROLLO y PRODUCCIÓN
// ============================================================================
// DEVELOPMENT: Solo registra en servidores principales (instantáneo, sin duplicados)
// PRODUCTION:  Registra en servidores principales + global (para todos los servidores)
// ============================================================================
const MODE = "DEVELOPMENT"; // Opciones: "DEVELOPMENT" o "PRODUCTION"

async function registerCommands() {
  const commands = [];

  // Ir a la carpeta correcta: desde register/ subir a commands/
  const commandsPath = path.join(__dirname, "..");
  const entries = await readdir(commandsPath, { withFileTypes: true });

  const commandFiles: string[] = [];

  // Buscar archivos .ts directamente en commands/ (excluyendo register)
  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.includes("register")
    ) {
      commandFiles.push(entry.name);
    }
    // Buscar carpetas con index.ts (como autorole/index.ts)
    else if (
      entry.isDirectory() &&
      entry.name !== "register" &&
      entry.name !== "clear" &&
      entry.name !== "debug"
    ) {
      const subfolderPath = path.join(commandsPath, entry.name);
      const subfolderEntries = await readdir(subfolderPath);
      if (subfolderEntries.includes("index.ts")) {
        commandFiles.push(`${entry.name}/index.ts`);
      }
    }
  }

  logger.info(`Found ${commandFiles.length} command files`, {
    context: "registerCommands",
    mode: MODE,
  });
  console.log(`📂 Encontrados ${commandFiles.length} archivos de comandos`);

  for (const file of commandFiles) {
    try {
      const command = await import(`../${file}`);
      if (command.data) {
        commands.push(command.data.toJSON());
        logger.debug(`Command loaded: ${file}`, {
          context: "registerCommands",
          commandName: command.data.name,
        });
        console.log(`✅ Cargado: ${file}`);
      }
    } catch (error) {
      logger.error(`Error loading command file: ${file}`, {
        error: error instanceof Error ? error.message : String(error),
        context: "registerCommands",
      });
      console.error(`❌ Error cargando ${file}:`, error);
    }
  }

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId1 = process.env.GUILD_ID;
  const guildId2 = process.env.GUILD_ID2;
  const guildId3 = process.env.GUILD_ID3;

  if (!token || !clientId) {
    logger.error("Missing required environment variables", {
      context: "registerCommands",
      hasToken: !!token,
      hasClientId: !!clientId,
    });
    throw new Error("❌ Faltan DISCORD_TOKEN o CLIENT_ID en .env");
  }

  logger.info(`Starting command registration in ${MODE} mode`, {
    context: "registerCommands",
    mode: MODE,
    commandCount: commands.length,
  });

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    logger.info(`Registering ${commands.length} commands`, {
      context: "registerCommands",
      mode: MODE,
    });
    console.log(
      `\n🔄 Registrando ${commands.length} comandos en modo: ${MODE}\n`,
    );

    if (MODE === "DEVELOPMENT") {
      // ========================================================================
      // MODO DESARROLLO: Solo registra en servidores principales (instantáneo)
      // ========================================================================
      // ✅ Ventajas:
      //    - Cambios instantáneos
      //    - Sin duplicados
      //    - Solo tus servidores tienen acceso
      // ❌ Desventajas:
      //    - No funciona en otros servidores
      // ========================================================================

      const mainGuilds = [guildId1, guildId2, guildId3].filter(Boolean);

      if (mainGuilds.length === 0) {
        logger.error("No GUILD_ID configured for development mode", {
          context: "registerCommands",
          mode: MODE,
        });
        throw new Error(
          "❌ No hay GUILD_ID configurado en .env para modo desarrollo",
        );
      }

      logger.info("Registering commands to main guilds", {
        context: "registerCommands",
        guildCount: mainGuilds.length,
      });

      console.log("📍 Registrando en servidores principales (instantáneo):");

      for (const guildId of mainGuilds) {
        try {
          const data = (await rest.put(
            Routes.applicationGuildCommands(clientId, guildId!),
            { body: commands },
          )) as any[];
          logger.info(`Commands registered to guild`, {
            context: "registerCommands",
            guildId: guildId,
            commandCount: data.length,
            mode: "DEVELOPMENT",
          });
          console.log(
            `   ✅ Servidor ${guildId}: ${data.length} comandos registrados`,
          );
        } catch (error) {
          logger.error(`Error registering commands to guild`, {
            error: error instanceof Error ? error.message : String(error),
            context: "registerCommands",
            guildId: guildId,
          });
          console.error(`   ❌ Error en servidor ${guildId}:`, error);
        }
      }

      logger.info("Command registration completed successfully", {
        context: "registerCommands",
        mode: "DEVELOPMENT",
        guildCount: mainGuilds.length,
      });
      console.log("\n✅ Registro completado exitosamente!");
      console.log("   📍 Comandos disponibles solo en servidores principales");
      console.log("   💡 Cambia MODE a 'PRODUCTION' para registro global");
    } else if (MODE === "PRODUCTION") {
      // ========================================================================
      // MODO PRODUCCIÓN: Registro global + servidores principales
      // ========================================================================
      // ✅ Ventajas:
      //    - Funciona en cualquier servidor donde esté el bot
      //    - Servidores principales tienen acceso instantáneo
      // ❌ Desventajas:
      //    - Comandos globales tardan ~1 hora en propagarse
      //    - Posibles duplicados temporales
      // ========================================================================

      const mainGuilds = [guildId1, guildId2, guildId3].filter(Boolean);

      // Registrar en servidores principales (instantáneo)
      if (mainGuilds.length > 0) {
        console.log("📍 Registrando en servidores principales (instantáneo):");

        for (const guildId of mainGuilds) {
          try {
            const data = (await rest.put(
              Routes.applicationGuildCommands(clientId, guildId!),
              { body: commands },
            )) as any[];
            logger.info(`Commands registered to guild (production)`, {
              context: "registerCommands",
              guildId: guildId,
              commandCount: data.length,
              mode: "PRODUCTION",
            });
            console.log(
              `   ✅ Servidor ${guildId}: ${data.length} comandos registrados`,
            );
          } catch (error) {
            logger.error(`Error registering commands to guild (production)`, {
              error: error instanceof Error ? error.message : String(error),
              context: "registerCommands",
              guildId: guildId,
            });
            console.error(`   ❌ Error en servidor ${guildId}:`, error);
          }
        }
      }

      // Registrar globalmente (tarda hasta 1 hora)
      logger.info("Registering global commands", {
        context: "registerCommands",
        mode: "PRODUCTION",
      });
      console.log(
        "\n🌍 Registrando comandos globales (puede tardar hasta 1 hora)...",
      );
      const globalData = (await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      })) as any[];
      logger.info("Global commands registered successfully", {
        context: "registerCommands",
        commandCount: globalData.length,
        mode: "PRODUCTION",
      });
      console.log(`   ✅ Global: ${globalData.length} comandos registrados`);

      logger.info("Command registration completed successfully", {
        context: "registerCommands",
        mode: "PRODUCTION",
        guildCount: mainGuilds.length,
      });
      console.log("\n✅ Registro completado exitosamente!");
      console.log(
        "   📍 Servidores principales: Comandos disponibles inmediatamente",
      );
      console.log("   🌍 Otros servidores: Comandos disponibles en ~1 hora");
    } else {
      logger.error("Invalid MODE value", {
        context: "registerCommands",
        mode: MODE,
      });
      throw new Error(
        `❌ MODE inválido: "${MODE}". Usa "DEVELOPMENT" o "PRODUCTION"`,
      );
    }
  } catch (error) {
    logger.error("Fatal error registering commands", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: "registerCommands",
    });
    console.error("❌ Error registrando comandos:", error);
  }
}

// Ejecutar si se llama directamente
registerCommands();
