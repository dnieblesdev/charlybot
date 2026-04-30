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
  logger.info(`Command executed: ${command}`, {
    userId,
    guildId,
    type: "command",
  });
};

export const logVoice = (
  userId: string,
  guildId: string,
  action: string,
  channelId?: string,
) => {
  logger.info(`Voice action: ${action}`, {
    userId,
    guildId,
    channelId,
    type: "voice",
  });
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};

export const logMusic = (
  guildId: string,
  action: string,
  details?: Record<string, any>,
) => {
  logger.info(`Music action: ${action}`, {
    guildId,
    type: "music",
    ...details,
  });
};

// Export the logger instance as default
export default logger;
