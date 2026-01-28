import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadCommands, loadEvents } from "../loader.ts";
import logger, { logError } from "../../utils/logger.ts";

export class DiscordClient {
  private client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.GuildMember, Partials.User],
    });
  }

  async start(token: string) {
    try {
      logger.info("🚀 Iniciando CharlyBot...");

      // Iniciar comandos y eventos
      logger.info("📦 Cargando comandos...");
      this.client.commands = await loadCommands(this.client);

      logger.info("🎯 Cargando eventos...");
      await loadEvents(this.client);

      // Login Client
      logger.info("🔐 Conectando con Discord...");
      await this.client.login(token);

      logger.info("✅ CharlyBot conectado correctamente");
    } catch (error) {
      if (error instanceof Error) {
        // Captura errores específicos de Discord (token inválido o intents no permitidos)
        if (error.message.includes("TOKEN_INVALID")) {
          logger.error("❌ Token de Discord inválido");
          logError(error, { context: "login", reason: "invalid_token" });
        } else if (error.message.includes("DISALLOWED_INTENTS")) {
          logger.error(
            "❌ Intents no permitidos. Verifica la configuración en Discord Developer Portal",
          );
          logError(error, { context: "login", reason: "intents_error" });
        } else {
          logger.error("❌ Error al iniciar el bot");
          logError(error, { context: "startup" });
        }
      }
      throw error; // Re-throw para que index.ts maneje el cierre
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info("🔌 Cerrando conexión con Discord...");
      this.client.destroy();
      logger.info("✅ Bot desconectado correctamente");
    } catch (error) {
      logger.error("❌ Error al cerrar el bot");
      if (error instanceof Error) {
        logError(error, { context: "shutdown" });
      }
      throw error;
    }
  }

  get instance(): Client {
    return this.client;
  }
}
