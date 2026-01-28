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
    const files = await readdir(commandsPath);
    const commandFiles = files.filter(
      (file) => file.endsWith(".ts") || file.endsWith(".js"),
    );

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = await import(filePath);

      if (command.data && command.execute) {
        commands.set(command.data.name, command);
        if (client && command.init) {
          await command.init(client);
        }
      } else {
        console.warn(`⚠️ Comando inválido en ${file}`);
      }
    }
  } catch (error) {
    console.error("Error cargando comandos:", error);
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
