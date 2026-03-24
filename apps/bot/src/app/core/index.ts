import { DiscordClient } from "./DiscordClient";
import dotenv from "dotenv";
import logger, { logError } from "../../utils/logger.ts";
import playdl from "play-dl";
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} from "@discordjs/voice";
import ffmpeg from "ffmpeg-static";
import { createReadStream } from "fs";
import { pipeline } from "stream";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

// Configurar ffmpeg con fallback chain: ffmpeg-static → sistema → error
let ffmpegPath: string | undefined;

if (ffmpeg && existsSync(ffmpeg)) {
  ffmpegPath = ffmpeg;
  logger.info("✅ ffmpeg-static configurado para @discordjs/voice", { path: ffmpegPath });
} else if (process.platform === "win32") {
  // Windows: buscar en PATH
  ffmpegPath = "ffmpeg";
  logger.info("✅ ffmpeg del sistema (Windows PATH) configurado", { path: ffmpegPath });
} else {
  // Linux/Docker: rutas típicas del sistema
  const systemPaths = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg", // macOS ARM
  ];
  for (const p of systemPaths) {
    if (existsSync(p)) {
      ffmpegPath = p;
      break;
    }
  }
  if (ffmpegPath) {
    logger.info("✅ ffmpeg del sistema configurado", { path: ffmpegPath });
  }
}

if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
} else {
  logger.error("❌ ffmpeg no encontrado en ninguna ubicación");
  process.exit(1);
}

dotenv.config();

// Inicializar play-dl para Spotify (si hay credenciales)
const initializePlayDl = async () => {
  try {
    const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
    const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (spotifyClientId && spotifyClientSecret) {
      await playdl.setToken({
        spotify: {
          client_id: spotifyClientId,
          client_secret: spotifyClientSecret,
          refresh_token: process.env.SPOTIFY_REFRESH_TOKEN || "",
          market: "US",
        },
      });
      logger.info("✅ play-dl configurado con Spotify");
    } else {
      logger.warn(
        "⚠️ Credenciales de Spotify no configuradas, solo funcionará YouTube",
      );
    }
  } catch (error) {
    logger.warn("⚠️ Error al configurar play-dl", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Inicializar play-dl
await initializePlayDl();

// Validate required environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  logger.error("❌ DISCORD_TOKEN no está definido en las variables de entorno");
  logger.error(
    "💡 Asegúrate de tener un archivo .env con DISCORD_TOKEN=tu_token",
  );
  process.exit(1);
}

// instanciando el cliente del bot
const bot = new DiscordClient();

// Comenzar el bot con error handling
bot.start(DISCORD_TOKEN).catch((error) => {
  logger.error("💥 Error fatal al iniciar el bot");
  logError(error, { context: "main_startup" });
  process.exit(1);
});

// Capturar errores no manejados
process.on("unhandledRejection", (reason, promise) => {
  logger.error("⚠️ Unhandled Rejection detectado");
  logError(new Error(String(reason)), {
    context: "unhandledRejection",
    promise: String(promise),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("⚠️ Uncaught Exception detectado");
  logError(error, { context: "uncaughtException" });
  process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`🛑 Señal ${signal} recibida, cerrando bot...`);
  try {
    await bot.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error durante el shutdown");
    process.exit(1);
  }
};

// Múltiples métodos para capturar Ctrl+C (compatibilidad con Bun)
process.on("SIGINT", () => {
  console.log("\n"); // Nueva línea después de ^C
  shutdown("SIGINT");
});

process.on("SIGTERM", () => shutdown("SIGTERM"));

// Método alternativo para Bun usando stdin
if (process.stdin.isTTY && process.stdin.setRawMode) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (key) => {
    // Detectar Ctrl+C (código 3)
    if (key.toString() === "\x03") {
      console.log("\n");
      shutdown("SIGINT (stdin)");
    }
  });
}
