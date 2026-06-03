import { fileURLToPath } from "url";
import path from "path";
import { createLogger, createChildLogger } from "@charlybot/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bot log directory: apps/bot/logs/
const LOG_DIR = path.join(__dirname, "../../logs");

// Re-export createChildLogger so consumers can get it from this module
export { createChildLogger };

// Default logger instance for the bot
const logger = createLogger({
  appName: "bot",
  logLevel: process.env.LOG_LEVEL || "info",
  logDir: LOG_DIR,
});

// Helper functions for common logging patterns
export const logCommand = (
  userId: string,
  guildId: string,
  command: string,
) => {
  logger.info({ userId, guildId, type: "command" }, `Command executed: ${command}`);
};

export const logVoice = (
  userId: string,
  guildId: string,
  action: string,
  channelId?: string,
) => {
  logger.info({ userId, guildId, channelId, type: "voice" }, `Voice action: ${action}`);
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(
    { stack: error.stack, ...context },
    error.message,
  );
};

export const logMusic = (
  guildId: string,
  action: string,
  details?: Record<string, unknown>,
) => {
  logger.info({ guildId, type: "music", ...details }, `Music action: ${action}`);
};

// Export the logger instance as default
export default logger;