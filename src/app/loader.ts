import { Client, Collection } from "discord.js";
import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(
  client?: Client,
): Promise<Collection<string, any>> {
  const commands: Collection<string, any> = new Collection();
  const commandsPath = path.join(__dirname, "commands");

  try {
    const entries = await readdir(commandsPath, { withFileTypes: true });
    const commandFiles: string[] = [];

    // Buscar archivos .ts/.js directamente en commands/
    for (const entry of entries) {
      if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))
      ) {
        commandFiles.push(entry.name);
      }
      // Buscar carpetas con index.ts/index.js (como autorole/index.ts)
      else if (entry.isDirectory()) {
        const subfolderPath = path.join(commandsPath, entry.name);
        const subfolderEntries = await readdir(subfolderPath);
        if (
          subfolderEntries.includes("index.ts") ||
          subfolderEntries.includes("index.js")
        ) {
          const indexFile = subfolderEntries.includes("index.ts")
            ? "index.ts"
            : "index.js";
          commandFiles.push(`${entry.name}/${indexFile}`);
        }
      }
    }

    console.log(`📋 Encontrados ${commandFiles.length} archivos de comandos`);

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
        const command = await import(filePath);

        if (command.data && command.execute) {
          commands.set(command.data.name, command);
          if (client && command.init) {
            await command.init(client);
          }
          console.log(`✅ Comando cargado: ${command.data.name} - ${file}`);
        } else {
          console.warn(`⚠️ Comando inválido en ${file}`);
        }
      } catch (error) {
        console.error(`❌ Error cargando comando ${file}:`, error);
      }
    }

    console.log(`🎯 ${commands.size} comandos cargados correctamente`);
  } catch (error) {
    console.error("❌ Error cargando comandos:", error);
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

    console.log(`📋 Encontrados ${eventFiles.length} archivos de eventos`);

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = await import(filePath);

      if (!event.default) {
        console.warn(`⚠️ Evento inválido en ${file}`);
        continue;
      }

      const evt = event.default;
      if (evt.once) {
        client.once(evt.name, (...args) => evt.execute(...args));
        console.log(`✅ Evento cargado (once): ${evt.name} - ${file}`);
      } else {
        client.on(evt.name, (...args) => evt.execute(...args));
        console.log(`✅ Evento cargado (on): ${evt.name} - ${file}`);
      }
    }

    console.log(`🎯 ${eventFiles.length} eventos cargados correctamente`);
  } catch (error) {
    console.error("❌ Error cargando eventos:", error);
  }
}
