import { REST, Routes } from "discord.js";
import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../apps/bot/src/utils/logger.ts";

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
  const commands: unknown[] = [];

  const appSrcPath = path.join(__dirname, "../apps/bot/src/app");
  const commandFiles: string[] = [];

  // Helper to discover command files in a directory
  async function discoverInDir(
    basePath: string,
    baseDir: string,
  ): Promise<void> {
    let entries;
    try {
      entries = await readdir(basePath, { withFileTypes: true });
    } catch {
      return; // Directory doesn't exist, skip
    }

    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.includes("register")
      ) {
        commandFiles.push(path.join(baseDir, entry.name));
      } else if (
        entry.isDirectory() &&
        entry.name !== "register" &&
        entry.name !== "clear" &&
        entry.name !== "debug"
      ) {
        const subfolderPath = path.join(basePath, entry.name);
        let subfolderEntries;
        try {
          subfolderEntries = await readdir(subfolderPath);
        } catch {
          continue;
        }
        if (subfolderEntries.includes("index.ts")) {
          commandFiles.push(path.join(baseDir, entry.name, "index.ts"));
        } else {
          // Also discover individual .ts files (e.g., context menus)
          for (const subEntry of subfolderEntries) {
            if (subEntry.endsWith(".ts")) {
              commandFiles.push(
                path.join(baseDir, entry.name, subEntry),
              );
            }
          }
        }
      }
    }
  }

  await discoverInDir(
    path.join(appSrcPath, "commands"),
    "commands",
  );
  await discoverInDir(
    path.join(appSrcPath, "context-menus"),
    "context-menus",
  );

  logger.info(`Found ${commandFiles.length} command files`, {
    context: "registerCommands",
    mode: MODE,
  });
  logger.info(`Encontrados ${commandFiles.length} archivos de comandos`, {
    context: "registerCommands",
    mode: MODE,
  });

  for (const file of commandFiles) {
    try {
      const command = await import(`../apps/bot/src/app/${file}`);
      if (command.data) {
        commands.push(command.data.toJSON());
        logger.debug(`Command loaded: ${file}`, {
          context: "registerCommands",
          commandName: command.data.name,
        });
        logger.info(`Cargado: ${file}`, { context: "registerCommands" });
      }
    } catch (error) {
      logger.error(`Error loading command file: ${file}`, {
        error: error instanceof Error ? error.message : String(error),
        context: "registerCommands",
      });
      logger.error(`Error cargando ${file}`, {
        error: error instanceof Error ? error.message : String(error),
        context: "registerCommands",
      });
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
    logger.info(`Registrando ${commands.length} comandos en modo: ${MODE}`, {
      context: "registerCommands",
      mode: MODE,
    });

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

        logger.info("Registrando en servidores principales (producción)", {
          context: "registerCommands",
          mode: "PRODUCTION",
        });

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
          logger.info(`Servidor ${guildId}: ${data.length} comandos registrados`, {
            context: "registerCommands",
            guildId,
          });
        } catch (error) {
          logger.error(`Error registering commands to guild`, {
            error: error instanceof Error ? error.message : String(error),
            context: "registerCommands",
            guildId: guildId,
          });
              logger.error(`Error en servidor ${guildId} (producción)`, {
                error: error instanceof Error ? error.message : String(error),
                context: "registerCommands",
                guildId,
              });
        }
      }

      logger.info("Command registration completed successfully", {
        context: "registerCommands",
        mode: "DEVELOPMENT",
        guildCount: mainGuilds.length,
      });
      logger.info("Registro completado exitosamente - servidores principales", {
        context: "registerCommands",
        mode: "DEVELOPMENT",
      });
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
      logger.info("Registrando en servidores principales (instantáneo)", {
        context: "registerCommands",
        guildCount: mainGuilds.length,
      });

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
              logger.info(`Servidor ${guildId}: ${data.length} comandos registrados (producción)`, {
                context: "registerCommands",
                guildId,
              });
          } catch (error) {
            logger.error(`Error registering commands to guild (production)`, {
              error: error instanceof Error ? error.message : String(error),
              context: "registerCommands",
              guildId: guildId,
            });
          logger.error(`Error en servidor ${guildId}`, {
            error: error instanceof Error ? error.message : String(error),
            context: "registerCommands",
            guildId,
          });
          }
        }
      }

      // Registrar globalmente (tarda hasta 1 hora)
      logger.info("Registering global commands", {
        context: "registerCommands",
        mode: "PRODUCTION",
      });
      logger.info("Registrando comandos globales (puede tardar hasta 1 hora)", {
        context: "registerCommands",
        mode: "PRODUCTION",
      });
      const globalData = (await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      })) as any[];
      logger.info("Global commands registered successfully", {
        context: "registerCommands",
        commandCount: globalData.length,
        mode: "PRODUCTION",
      });
      logger.info(`Global: ${globalData.length} comandos registrados`, {
        context: "registerCommands",
        mode: "PRODUCTION",
      });

      logger.info("Command registration completed successfully", {
        context: "registerCommands",
        mode: "PRODUCTION",
        guildCount: mainGuilds.length,
      });
      logger.info("Registro completado exitosamente - producción", {
        context: "registerCommands",
        mode: "PRODUCTION",
        guildCount: mainGuilds.length,
      });
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
    logger.error("Error registrando comandos", {
      error: error instanceof Error ? error.message : String(error),
      context: "registerCommands",
    });
  }
}

// Ejecutar si se llama directamente
registerCommands();
