import { Client, Collection } from "discord.js";
import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(
  client?: Client,
): Promise<Collection<string, any>> {
  const commands: Collection<string, any> = new Collection();
  const commandsPath = path.join(__dirname, "commands");
  const contextMenusPath = path.join(__dirname, "context-menus");

  try {
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
          (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))
        ) {
          commandFiles.push(path.join(baseDir, entry.name));
        } else if (entry.isDirectory()) {
          const subfolderPath = path.join(basePath, entry.name);

          if (
            entry.name === "register" ||
            entry.name === "clear" ||
            entry.name === "debug"
          ) {
            continue;
          }

          let subfolderEntries;
          try {
            subfolderEntries = await readdir(subfolderPath);
          } catch {
            continue;
          }

          if (
            subfolderEntries.includes("index.ts") ||
            subfolderEntries.includes("index.js")
          ) {
            const indexFile = subfolderEntries.includes("index.ts")
              ? "index.ts"
              : "index.js";
            commandFiles.push(path.join(baseDir, entry.name, indexFile));
          } else {
            // Also discover individual .ts files (e.g., context menus)
            for (const subEntry of subfolderEntries) {
              if (subEntry.endsWith(".ts") || subEntry.endsWith(".js")) {
                commandFiles.push(
                  path.join(baseDir, entry.name, subEntry),
                );
              }
            }
          }
        }
      }
    }

    await discoverInDir(commandsPath, "commands");
    await discoverInDir(contextMenusPath, "context-menus");

    logger.info(`📋 Encontrados ${commandFiles.length} archivos de comandos`);

    for (const file of commandFiles) {
      const filePath = path.join(__dirname, file);
      try {
        const command = await import(filePath);

        if (command.data && command.execute) {
          commands.set(command.data.name, command);
          if (client && command.init) {
            await command.init(client);
          }
          logger.info(`✅ Comando cargado: ${command.data.name} - ${file}`);
        } else {
          logger.warn(`⚠️ Comando inválido en ${file}`);
        }
      } catch (error) {
        logger.error(`❌ Error cargando comando ${file}`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.info(`🎯 ${commands.size} comandos cargados correctamente`);
  } catch (error) {
    logger.error("❌ Error cargando comandos", { error: error instanceof Error ? error.message : String(error) });
  }

  return commands;
}

export async function loadEvents(client: Client) {
  const eventsPath = path.join(__dirname, "events");

  try {
    const files = await readdir(eventsPath);
    const eventFiles = files.filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js"),
    );

    logger.info(`📋 Encontrados ${eventFiles.length} archivos de eventos`);

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = await import(filePath);

      if (!event.default) {
        logger.warn(`⚠️ Evento inválido en ${file}`);
        continue;
      }

      const evt = event.default;
      if (evt.once) {
        client.once(evt.name, (...args) => evt.execute(...args));
        logger.info(`✅ Evento cargado (once): ${evt.name} - ${file}`);
      } else {
        client.on(evt.name, (...args) => evt.execute(...args));
        logger.info(`✅ Evento cargado (on): ${evt.name} - ${file}`);
      }
    }

    logger.info(`🎯 ${eventFiles.length} eventos cargados correctamente`);
  } catch (error) {
    logger.error("❌ Error cargando eventos", { error: error instanceof Error ? error.message : String(error) });
  }
}
