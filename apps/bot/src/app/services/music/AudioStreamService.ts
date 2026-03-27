/**
 * AudioStreamService - Resolución y stream de audio
 * 
 * Responsabilidades:
 * - Resolver queries (URLs de YouTube/Spotify o texto de búsqueda) a StreamSource
 * - Crear streams de audio usando play-dl (primario) o yt-dlp (fallback)
 * - Validar formatos y límites
 * - Manejo de errores con retry
 * - Cleanup de recursos
 * 
 * Este servicio forma parte de la arquitectura de servicios de música:
 * - VoiceConnectionService: conexiones de voz
 * - AudioStreamService: resolución y stream de audio
 * - QueueManagementService: gestión de colas
 * - PlayerService: control de reproducción
 */

import { createReadStream, unlink } from "fs";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { which } from "bun";
import { spawn } from "child_process";
import playdl, {
  type YouTubeVideo,
  type SpotifyTrack,
  type SpotifyPlaylist,
} from "play-dl";
import YTDlpWrap from "yt-dlp-wrap";
import type { StreamSource, StreamOptions, Song } from "./types";
import logger from "../../../utils/logger";
import {
  DEFAULT_MUSIC_CONFIG,
  MUSIC_MESSAGES,
  type MusicConfig,
} from "../../../config/music";

// ============================================================================
// Interfaces Internas
// ============================================================================

interface StreamState {
  activeStreams: Map<string, ReadableStream>;
  ytDlp: YTDlpWrap;
  config: MusicConfig;
}

// ============================================================================
// Configuración
// ============================================================================

const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const STREAM_TIMEOUT_MS = 15000;
const TEMP_FILE_CLEANUP_MS = 300000; // 5 minutos

// ============================================================================
// Helper Functions (copied from original MusicService)
// ============================================================================

/**
 * Helper function to find yt-dlp: buscar en PATH primero, luego fallback local
 */
const getYtDlpPath = (): string => {
  const systemYtDlp = which("yt-dlp");
  if (systemYtDlp) return systemYtDlp;
  // Fallback: buscar en bin/ del proyecto
  return path.join(process.cwd(), "bin", "yt-dlp.exe");
};

/**
 * Limpia queries de búsqueda de caracteres especiales y términos problemáticos
 */
const cleanSearchQuery = (query: string): string => {
  try {
    let cleaned = query.trim();

    // Remover caracteres especiales de títulos de playlists
    cleaned = cleaned.replace(/【.*?】/g, ""); // Remover corchetes japoneses
    cleaned = cleaned.replace(/♬/g, ""); // Remover símbolos musicales
    cleaned = cleaned.replace(/\[.*?Playlist.*?\]/gi, ""); // Remover [Playlist]
    cleaned = cleaned.replace(/\[.*?BGM.*?\]/gi, ""); // Remover [BGM]
    cleaned = cleaned.replace(/lofi hip hop radio/gi, "lofi hip hop"); // Evitar radios
    cleaned = cleaned.replace(/24\/7/g, ""); // Remover indicadores de stream 24/7
    cleaned = cleaned.replace(/live/gi, ""); // Remover "live"
    cleaned = cleaned.replace(/radio/gi, ""); // Remover "radio"

    // Limpiar múltiples espacios
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // Si después de limpiar queda muy poco, usar términos más genéricos
    if (cleaned.length < 10) {
      if (query.toLowerCase().includes("r&b")) {
        cleaned = "R&B music hits";
      } else if (query.toLowerCase().includes("jazz")) {
        cleaned = "Jazz music";
      }
    }

    return cleaned;
  } catch (error) {
    logger.warn("Error cleaning search query, using original", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    return query;
  }
};

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for AudioStreamService
 */
class AudioStreamError extends Error {
  constructor(message: string, override cause?: Error) {
    super(message);
    this.name = "AudioStreamError";
    Object.setPrototypeOf(this, AudioStreamError.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AudioStreamError);
    }
  }
}

/**
 * Error thrown when search operations fail
 */
class SearchError extends AudioStreamError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "SearchError";
    Object.setPrototypeOf(this, SearchError.prototype);
  }
}

/**
 * Error thrown when stream creation fails
 */
class StreamCreationError extends AudioStreamError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "StreamCreationError";
    Object.setPrototypeOf(this, StreamCreationError.prototype);
  }
}

/**
 * Error thrown when validation fails
 */
class ValidationError extends AudioStreamError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// ============================================================================
// AudioStreamService - Implementación
// ============================================================================

class AudioStreamServiceImpl {
  private state: StreamState;
  private retryMaxAttempts: number;
  private retryDelayMs: number;
  private config: MusicConfig;

  constructor(
    config: MusicConfig = DEFAULT_MUSIC_CONFIG,
    retryMaxAttempts: number = DEFAULT_RETRY_MAX_ATTEMPTS,
    retryDelayMs: number = DEFAULT_RETRY_DELAY_MS
  ) {
    this.config = config;
    this.retryMaxAttempts = retryMaxAttempts;
    this.retryDelayMs = retryDelayMs;

    // Inicializar estado
    const ytDlpPath = getYtDlpPath();
    this.state = {
      activeStreams: new Map(),
      ytDlp: new YTDlpWrap(ytDlpPath),
      config,
    };

    logger.info("🎵 AudioStreamService inicializado", {
      retryMaxAttempts,
      retryDelayMs,
      ytDlpPath,
    });
  }

  // ============================================================================
  // 3.1 Estructura básica - Constructor y dependencias
  // ============================================================================

  /**
   * Obtiene la configuración actual del servicio
   */
  getConfig(): MusicConfig {
    return this.config;
  }

  /**
   * Actualiza la configuración del servicio
   */
  setConfig(config: MusicConfig): void {
    this.config = config;
    this.state.config = config;
    logger.debug("AudioStreamService config actualizada", { config });
  }

  // ============================================================================
  // 3.2 Implementar searchSongs() - YouTube/Spotify search con play-dl
  // ============================================================================

  /**
   * Busca canciones desde YouTube o Spotify y retorna un array de StreamSource
   * 
   * @param query - Query de búsqueda (URL o texto)
   * @param guildId - ID del servidor (para logging)
   * @returns Promise<StreamSource[]> - Array de fuentes de stream encontradas
   */
  async searchSongs(
    query: string,
    guildId: string
  ): Promise<StreamSource[]> {
    logger.info("🔍 Buscando canciones", { query, guildId });

    const cleanQuery = cleanSearchQuery(query);

    // Verificar si es una URL de Spotify
    const spotifyValidation = playdl.sp_validate(query);

    if (spotifyValidation === "track") {
      return await this.handleSpotifyTrack(query, guildId);
    }

    if (spotifyValidation === "playlist") {
      return await this.handleSpotifyPlaylist(query, guildId);
    }

    // Verificar si es una playlist de YouTube
    if (playdl.yt_validate(query) === "playlist") {
      return await this.handleYouTubePlaylist(query, guildId);
    }

    // Verificar si es un video de YouTube
    if (playdl.yt_validate(query) === "video") {
      return await this.handleYouTubeVideo(query, guildId);
    }

    // Es una búsqueda de texto - buscar en YouTube
    return await this.handleYouTubeSearch(cleanQuery, guildId);
  }

  /**
   * Maneja un track de Spotify - convierte a YouTube
   */
  private async handleSpotifyTrack(
    query: string,
    guildId: string
  ): Promise<StreamSource[]> {
    logger.info("🎵 Detectado track de Spotify", { url: query, guildId });

    try {
      // Timeout para evitar bloqueos
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Timeout: playdl.spotify() tardó más de 10 segundos")),
          10000
        );
      });

      const spotifyInfo = await Promise.race([
        playdl.spotify(query) as Promise<SpotifyTrack>,
        timeoutPromise,
      ]);

      const searchQuery = `${spotifyInfo.name} ${spotifyInfo.artists?.[0]?.name || ""}`;
      logger.debug("🔍 Buscando en YouTube", { searchQuery, guildId });

      // Buscar en YouTube
      const searchResult = await this.retrySearch(() =>
        playdl.search(searchQuery, {
          limit: 1,
          source: { youtube: "video" },
        })
      );

      if (searchResult.length === 0) {
        throw new SearchError("No se pudo encontrar la canción en YouTube");
      }

      const video = searchResult[0];
      if (!video) {
        throw new SearchError("No se pudo encontrar la canción en YouTube");
      }
      return [
        {
          url: video.url,
          title: video.title || spotifyInfo.name,
          duration: video.durationInSec || Math.floor(spotifyInfo.durationInMs / 1000),
          thumbnail: video.thumbnails?.[0]?.url,
          platform: "youtube",
        },
      ];
    } catch (error) {
      logger.error("💥 Error procesando track de Spotify", {
        query,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new SearchError(
        `Error procesando track de Spotify: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Maneja una playlist de Spotify
   */
  private async handleSpotifyPlaylist(
    query: string,
    guildId: string
  ): Promise<StreamSource[]> {
    logger.info("🎵 Detectada playlist de Spotify", { url: query, guildId });

    try {
      const playlist = await playdl.spotify(query) as SpotifyPlaylist;
      const videos: StreamSource[] = [];

      // Limitar número de tracks - use page() method to get tracks
      const maxTracks = this.config.maxPlaylistTracks;
      const allTracks = playlist.page(1);
      const tracks = allTracks.slice(0, maxTracks);

      for (const track of tracks) {
        const searchQuery = `${track.name} ${track.artists?.[0]?.name || ""}`;
        
        try {
          const searchResult = await this.retrySearch(() =>
            playdl.search(searchQuery, {
              limit: 1,
              source: { youtube: "video" },
            })
          );

          if (searchResult.length > 0) {
            const video = searchResult[0];
            // Evitar streams y videos muy largos
            if (video && video.durationInSec > 0 && video.durationInSec <= 7200) {
              videos.push({
                url: video.url,
                title: video.title || track.name,
                duration: video.durationInSec,
                thumbnail: video.thumbnails?.[0]?.url,
                platform: "youtube",
              });
            }
          }
        } catch (error) {
          logger.warn("Error buscando track de playlist en YouTube", {
            track: track.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Delay entre búsquedas para evitar rate limiting
        if (tracks.indexOf(track) % this.config.playlistBatchSize === 0) {
          await new Promise((resolve) => setTimeout(resolve, this.config.batchDelayMs));
        }
      }

      logger.info("✅ Playlist de Spotify procesada", {
        guildId,
        totalTracks: tracks.length,
        foundVideos: videos.length,
      });

      return videos;
    } catch (error) {
      logger.error("💥 Error procesando playlist de Spotify", {
        query,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new SearchError(
        `Error procesando playlist de Spotify: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Maneja una playlist de YouTube
   */
  private async handleYouTubePlaylist(
    query: string,
    guildId: string
  ): Promise<StreamSource[]> {
    logger.info("🎵 Detectada playlist de YouTube", { url: query, guildId });

    try {
      const playlist = await playdl.playlist_info(query, {
        incomplete: true,
      });
      const videos = await playlist.all_videos();

      const maxTracks = this.config.maxPlaylistTracks;
      return videos
        .slice(0, maxTracks)
        .filter((video) => video !== undefined && video.url)
        .map((video) => ({
          url: video.url,
          title: video.title || "Título desconocido",
          duration: video.durationInSec || 0,
          thumbnail: video.thumbnails?.[0]?.url,
          platform: "youtube" as const,
        }));
    } catch (error) {
      logger.error("💥 Error procesando playlist de YouTube", {
        query,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new SearchError(
        `Error procesando playlist de YouTube: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Maneja un video de YouTube directo
   */
  private async handleYouTubeVideo(
    query: string,
    guildId: string
  ): Promise<StreamSource[]> {
    logger.debug("🎵 Detectado video de YouTube", { url: query, guildId });

    try {
      const info = await playdl.video_basic_info(query);
      const video = info.video_details;

      if (!video) {
        throw new SearchError("No se pudo obtener información del video");
      }

      return [
        {
          url: query, // Usar la query original
          title: video.title || "Título desconocido",
          duration: video.durationInSec || 0,
          thumbnail: video.thumbnails?.[0]?.url,
          platform: "youtube",
        },
      ];
    } catch (error) {
      logger.error("💥 Error obteniendo info de video de YouTube", {
        query,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: usar URL directamente
      return [
        {
          url: query,
          title: "Video de YouTube",
          duration: 0,
          thumbnail: undefined,
          platform: "youtube",
        },
      ];
    }
  }

  /**
   * Maneja búsqueda de texto en YouTube
   */
  private async handleYouTubeSearch(
    query: string,
    guildId: string
  ): Promise<StreamSource[]> {
    logger.debug("🔍 Buscando en YouTube", { query, guildId });

    try {
      const searchResult = await this.retrySearch(() =>
        playdl.search(query, {
          limit: 3,
          source: { youtube: "video" },
        })
      );

      if (searchResult.length === 0) {
        logger.warn("No se encontraron resultados", { query, guildId });
        return [];
      }

      // Buscar el mejor resultado que no sea una playlist o stream en vivo
      let bestVideo: YouTubeVideo | null = null;
      for (const video of searchResult) {
        if (!video || !video.url || typeof video.title !== "string") {
          continue;
        }

        // Evitar streams y videos > 2 horas
        if (video.durationInSec === 0 || video.durationInSec > 7200) {
          continue;
        }

        bestVideo = video;
        break;
      }

      if (!bestVideo) {
        return [];
      }

      return [
        {
          url: bestVideo.url,
          title: bestVideo.title || "Título desconocido",
          duration: bestVideo.durationInSec || 0,
          thumbnail: bestVideo.thumbnails?.[0]?.url,
          platform: "youtube",
        },
      ];
    } catch (error) {
      logger.error("💥 Error en búsqueda de YouTube", {
        query,
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new SearchError(
        `Error en búsqueda de YouTube: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============================================================================
  // 3.3 Implementar resolveStreamSource() - convertir Song a StreamSource
  // ============================================================================

  /**
   * Resuelve una query a un StreamSource listo para streaming
   * 
   * @param query - Query de búsqueda (URL o texto)
   * @param guildId - ID del servidor
   * @returns Promise<StreamSource> - Fuente de stream resuelta
   */
  async resolve(query: string, guildId: string): Promise<StreamSource> {
    logger.info("🎵 Resolviendo stream source", { query, guildId });

    const sources = await this.searchSongs(query, guildId);

    if (sources.length === 0) {
      throw new SearchError("No se encontraron resultados para la búsqueda");
    }

    // Retornar el primer resultado
    const source = sources[0];
    if (!source) {
      throw new SearchError("No se encontraron resultados para la búsqueda");
    }
    logger.info("✅ Stream source resuelto", {
      guildId,
      title: source.title,
      url: source.url,
      platform: source.platform,
    });

    return source;
  }

  // ============================================================================
  // 3.4 Implementar createAudioStream() - obtener audio stream desde URL
  // ============================================================================

  /**
   * Crea un stream de audio desde un StreamSource
   * 
   * @param source - Fuente de stream resuelta
   * @param options - Opciones adicionales para el stream
   * @returns Promise<ReadableStream> - Stream de audio listo para reproducir
   */
  async createStream(
    source: StreamSource,
    options?: StreamOptions
  ): Promise<ReadableStream> {
    const { url, title } = source;
    const guildId = options?.seeking ? "seek" : "stream";

    logger.info("🎵 Creando audio stream", {
      url,
      title,
      platform: source.platform,
      guildId,
    });

    try {
      // Detectar la plataforma y crear el stream apropiado
      if (source.platform === "spotify" || url.includes("spotify.com")) {
        return await this.createSpotifyStream(url, guildId, options);
      }

      if (
        source.platform === "youtube" ||
        url.includes("youtube.com") ||
        url.includes("youtu.be")
      ) {
        return await this.createYouTubeStream(url, guildId, options);
      }

      // Fallback: intentar como YouTube
      return await this.createYouTubeStream(url, guildId, options);
    } catch (error) {
      logger.error("💥 Error creando stream", {
        url,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new StreamCreationError(
        `Error creando stream: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Crea stream para Spotify usando play-dl
   */
  private async createSpotifyStream(
    url: string,
    guildId: string,
    options?: StreamOptions
  ): Promise<ReadableStream> {
    logger.debug("🎵 Creando stream de Spotify", { url, guildId });

    const qualities = [2, 1, 0];

    for (const quality of qualities) {
      try {
        const streamPromise = playdl.stream(url, { quality });
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Stream timeout for quality ${quality}`)),
            this.config.streamTimeoutMs
          );
        });

        const streamResponse = await Promise.race([
          streamPromise,
          timeoutPromise,
        ]);

        if (!streamResponse || !("stream" in streamResponse)) {
          throw new Error(`Stream is null for quality ${quality}`);
        }

        const stream = (streamResponse as { stream: unknown }).stream;
        if (!stream) {
          throw new Error(`Stream is null for quality ${quality}`);
        }

        logger.info("✅ Spotify stream creado", { guildId, quality });
        return stream as ReadableStream;
      } catch (error) {
        logger.debug(`Quality ${quality} failed, trying next`, {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Delay entre intentos
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.rateLimitDelayMs)
        );
      }
    }

    throw new StreamCreationError("Todas las calidades de Spotify fallaron");
  }

  /**
   * Crea stream para YouTube usando yt-dlp + ffmpeg
   */
  private async createYouTubeStream(
    url: string,
    guildId: string,
    options?: StreamOptions
  ): Promise<ReadableStream> {
    logger.debug("🎵 Creando stream de YouTube", { url, guildId });

    // Intentar con yt-dlp + ffmpeg directo
    try {
      return await this.createYtDlpStream(url, guildId, options);
    } catch (error) {
      logger.warn("yt-dlp directo falló, intentando con video info", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: obtener info del video y usar la URL directa
      try {
        const videoInfo = await this.getVideoInfoWithYtDlp(url);
        if (videoInfo?.streamUrl) {
          const https = await import("https");
          return new Promise<ReadableStream>((resolve, reject) => {
            https
              .get(videoInfo.streamUrl, (response) => {
                if (response.statusCode !== 200) {
                  reject(new Error(`HTTP ${response.statusCode}`));
                  return;
                }
                resolve(response as unknown as ReadableStream);
              })
              .on("error", reject);
          });
        }
      } catch (videoInfoError) {
        logger.error("yt-dlp video info también falló", {
          guildId,
          error:
            videoInfoError instanceof Error
              ? videoInfoError.message
              : String(videoInfoError),
        });
      }

      throw error;
    }
  }

  /**
   * Crea stream usando yt-dlp + ffmpeg
   */
  private async createYtDlpStream(
    url: string,
    guildId: string,
    options?: StreamOptions
  ): Promise<ReadableStream> {
    const streamId = `yt_${guildId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const ytDlpPath = getYtDlpPath();
      const ffmpegPath = process.env.FFMPEG_PATH;

      if (!ffmpegPath) {
        reject(new Error("ffmpeg no encontrado"));
        return;
      }

      // Proceso yt-dlp
      const ytDlpProcess = spawn(ytDlpPath, [
        "--format",
        "bestaudio/best",
        "--no-playlist",
        "--quiet",
        "--extractor-args",
        "youtube:player_client=default",
        "--output",
        "-",
        url,
      ]);

      // Proceso ffmpeg para procesar el audio como PCM
      const ffmpegProcess = spawn(ffmpegPath, [
        "-i",
        "pipe:0", // Input desde stdin (yt-dlp)
        "-f",
        "s16le", // Output format: PCM 16-bit little-endian
        "-ar",
        "48000", // Sample rate: 48kHz (requerido por Discord)
        "-ac",
        "2", // Audio channels: 2 (stereo)
        "-avoid_negative_ts",
        "make_zero", // Fix negative timestamps
        "-threads",
        "1", // Usar un solo hilo para reducir velocidad
        "pipe:1", // Output to stdout
      ]);

      // Conectar yt-dlp stdout con ffmpeg stdin
      ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);

      let hasData = false;
      const timeout = setTimeout(() => {
        if (!hasData) {
          ytDlpProcess.kill();
          ffmpegProcess.kill();
          reject(new Error("yt-dlp + ffmpeg stream timeout"));
        }
      }, STREAM_TIMEOUT_MS);

      // PassThrough stream para manejar el flujo
      const { PassThrough } = require("stream");
      const passthroughStream = new PassThrough();

      // Usar on("data") para manejar cada chunk individualmente
      ffmpegProcess.stdout.on("data", (chunk: Buffer) => {
        if (!hasData) {
          hasData = true;
          clearTimeout(timeout);
          logger.debug("ffmpeg first chunk received", { url, guildId, size: chunk.length });
        }
        // Escribir cada chunk al passthrough
        passthroughStream.write(chunk);
      });

      ffmpegProcess.stdout.on("end", () => {
        logger.debug("ffmpeg stream ended", { url, guildId });
        passthroughStream.end();
        this.state.activeStreams.delete(streamId);
      });

      ffmpegProcess.stdout.on("error", (err: Error) => {
        logger.error("ffmpeg stdout error", { url, guildId, error: err.message });
        passthroughStream.destroy(err);
      });

      // Registrar stream activo
      this.state.activeStreams.set(streamId, passthroughStream as unknown as ReadableStream);

      // Resolver cuando el passthrough esté listo
      setImmediate(() => {
        resolve(passthroughStream as unknown as ReadableStream);
      });

      ytDlpProcess.stderr.on("data", (data) => {
        logger.debug("yt-dlp stderr", { data: data.toString() });
      });

      ffmpegProcess.stderr.on("data", (data) => {
        logger.debug("ffmpeg stderr", { data: data.toString() });
      });

      ytDlpProcess.on("error", (error) => {
        clearTimeout(timeout);
        ffmpegProcess.kill();
        reject(new Error(`yt-dlp error: ${error.message}`));
      });

      ffmpegProcess.on("error", (error) => {
        clearTimeout(timeout);
        ytDlpProcess.kill();
        reject(new Error(`ffmpeg error: ${error.message}`));
      });

      ytDlpProcess.on("exit", (code) => {
        if (code !== 0) {
          logger.warn("yt-dlp exited with code", { code, url });
        }
      });

      ffmpegProcess.on("exit", (code) => {
        clearTimeout(timeout);
        if (code !== 0 && !hasData) {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Obtiene info del video usando yt-dlp
   */
  private async getVideoInfoWithYtDlp(url: string): Promise<{
    title: string;
    duration: number;
    streamUrl: string;
    thumbnail?: string;
  } | null> {
    try {
      logger.debug("Getting video info with yt-dlp", { url });

      const info = await this.state.ytDlp.getVideoInfo(url);

      if (!info) {
        throw new Error("No video info returned from yt-dlp");
      }

      // Get best audio format URL
      const audioFormats =
        info.formats?.filter(
          (f: { acodec?: string; vcodec?: string; abr?: number; url?: string }) =>
            f.acodec && f.acodec !== "none" && !f.vcodec
        ) || [];

      if (audioFormats.length === 0) {
        const mixedFormats =
          info.formats?.filter(
            (f: { acodec?: string; vcodec?: string; abr?: number; url?: string }) =>
              f.acodec && f.acodec !== "none"
          ) || [];

        if (mixedFormats.length === 0) {
          throw new Error("No audio formats available");
        }

        const bestMixed = mixedFormats.sort(
          (a: { abr?: number }, b: { abr?: number }) => (b.abr || 0) - (a.abr || 0)
        )[0];

        return {
          title: info.title || "Unknown Title",
          duration: parseInt(String(info.duration)) || 0,
          streamUrl: bestMixed.url || "",
          thumbnail: info.thumbnail,
        };
      }

      const bestAudio = audioFormats.sort(
        (a: { abr?: number }, b: { abr?: number }) => (b.abr || 0) - (a.abr || 0)
      )[0];

      return {
        title: info.title || "Unknown Title",
        duration: parseInt(String(info.duration)) || 0,
        streamUrl: bestAudio.url || "",
        thumbnail: info.thumbnail,
      };
    } catch (error) {
      logger.error("Error with yt-dlp", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ============================================================================
  // 3.5 Implementar retry logic y manejo de errores
  // ============================================================================

  /**
   * Ejecuta una función con retry automático
   */
  private async retrySearch<T>(
    fn: () => Promise<T>,
    maxAttempts: number = this.retryMaxAttempts
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // No reintentar en errores específicos
        if (
          error instanceof TypeError &&
          error.message.includes("navigationEndpoint")
        ) {
          throw error;
        }

        if (attempt < maxAttempts) {
          const delay = this.retryDelayMs * attempt;
          logger.debug("Retry attempt", { attempt, maxAttempts, delay });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Valida un StreamSource antes de crear el stream
   */
  async validate(source: StreamSource): Promise<void> {
    logger.debug("Validando StreamSource", {
      title: source.title,
      url: source.url,
      platform: source.platform,
    });

    // Validar que tiene URL
    if (!source.url || typeof source.url !== "string") {
      throw new ValidationError("StreamSource no tiene URL válida");
    }

    // Validar que tiene título
    if (!source.title || typeof source.title !== "string") {
      throw new ValidationError("StreamSource no tiene título válido");
    }

    // Validar plataforma
    if (!["youtube", "spotify", "soundcloud", "other"].includes(source.platform)) {
      throw new ValidationError("Plataforma no soportada");
    }

    // Validar duración máxima (2 horas)
    if (source.duration > 7200) {
      throw new ValidationError("La duración máxima es de 2 horas");
    }

    logger.debug("✅ StreamSource validado", { title: source.title });
  }

  // ============================================================================
  // 3.6 Implementar stream cleanup y resource management
  // ============================================================================

  /**
   * Limpia un stream activo
   */
  cleanupStream(streamId: string): void {
    const stream = this.state.activeStreams.get(streamId);
    if (stream) {
      try {
        if (typeof (stream as unknown as { destroy?: () => void }).destroy === "function") {
          (stream as unknown as { destroy: () => void }).destroy();
        }
        this.state.activeStreams.delete(streamId);
        logger.debug("Stream limpiado", { streamId });
      } catch (error) {
        logger.warn("Error limpiando stream", {
          streamId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Limpia todos los streams activos
   */
  cleanupAllStreams(): void {
    logger.info("🧹 Limpiando todos los streams activos", {
      count: this.state.activeStreams.size,
    });

    for (const [streamId, stream] of this.state.activeStreams) {
      try {
        if (typeof (stream as unknown as { destroy?: () => void }).destroy === "function") {
          (stream as unknown as { destroy: () => void }).destroy();
        }
      } catch (error) {
        logger.warn("Error limpiando stream", {
          streamId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.state.activeStreams.clear();
    logger.info("✅ Todos los streams limpiados");
  }

  /**
   * Obtiene el número de streams activos
   */
  getActiveStreamCount(): number {
    return this.state.activeStreams.size;
  }

  /**
   * Obtiene todos los IDs de streams activos
   */
  getActiveStreamIds(): string[] {
    return Array.from(this.state.activeStreams.keys());
  }
}

// ============================================================================
// Instancia singleton
// ============================================================================

let audioStreamServiceInstance: AudioStreamServiceImpl | null = null;

/**
 * Obtiene la instancia singleton de AudioStreamService
 */
function getAudioStreamService(): AudioStreamServiceImpl {
  if (!audioStreamServiceInstance) {
    audioStreamServiceInstance = new AudioStreamServiceImpl();
  }
  return audioStreamServiceInstance;
}

// ============================================================================
// Exports
// ============================================================================

export const AudioStreamService = {
  // 3.1 Basic structure
  getConfig: () => getAudioStreamService().getConfig(),
  setConfig: (config: MusicConfig) => getAudioStreamService().setConfig(config),

  // 3.2 Search songs
  searchSongs: (...args: Parameters<AudioStreamServiceImpl["searchSongs"]>) =>
    getAudioStreamService().searchSongs(...args),

  // 3.3 Resolve stream source
  resolve: (...args: Parameters<AudioStreamServiceImpl["resolve"]>) =>
    getAudioStreamService().resolve(...args),

  // 3.4 Create audio stream
  createStream: (...args: Parameters<AudioStreamServiceImpl["createStream"]>) =>
    getAudioStreamService().createStream(...args),

  // 3.5 Validation
  validate: (...args: Parameters<AudioStreamServiceImpl["validate"]>) =>
    getAudioStreamService().validate(...args),

  // 3.6 Cleanup
  cleanupStream: (...args: Parameters<AudioStreamServiceImpl["cleanupStream"]>) =>
    getAudioStreamService().cleanupStream(...args),
  cleanupAllStreams: () => getAudioStreamService().cleanupAllStreams(),
  getActiveStreamCount: () => getAudioStreamService().getActiveStreamCount(),
  getActiveStreamIds: () => getAudioStreamService().getActiveStreamIds(),
};

// ============================================================================
// Factory para testing e inyección de dependencias
// ============================================================================

export function createAudioStreamService(
  config?: MusicConfig,
  retryMaxAttempts?: number,
  retryDelayMs?: number
): AudioStreamServiceImpl {
  return new AudioStreamServiceImpl(config, retryMaxAttempts, retryDelayMs);
}

// ============================================================================
// Errores exportados
// ============================================================================

export { AudioStreamError, SearchError, StreamCreationError, ValidationError };
