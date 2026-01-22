import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  VoiceConnection,
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} from "@discordjs/voice";
import { Readable } from "stream";
import type { VoiceChannel, StageChannel, TextChannel } from "discord.js";
import type { MusicQueue, Song, LoopMode } from "../../types/music.ts";
import logger from "../../utils/logger.ts";
import playdl from "play-dl";
import {
  DEFAULT_MUSIC_CONFIG,
  getOptimalConfig,
  MUSIC_MESSAGES,
  type MusicConfig,
} from "../../config/music.ts";
import YTDlpWrap from "yt-dlp-wrap";
import { createReadStream } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { spawn } from "child_process";

class MusicService {
  private queues = new Map<string, MusicQueue>();
  private ytDlp: YTDlpWrap;
  private config: MusicConfig;
  private playlistBuffers = new Map<string, any>();

  constructor() {
    this.queues = new Map();
    // Initialize configuration
    this.config = DEFAULT_MUSIC_CONFIG;
    // Initialize yt-dlp wrapper with path to executable
    const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");
    this.ytDlp = new YTDlpWrap(ytDlpPath);
  }

  /**
   * Une el bot a un canal de voz
   */
  async join(
    guildId: string,
    voiceChannel: VoiceChannel | StageChannel,
    textChannel: TextChannel,
  ): Promise<VoiceConnection> {
    try {
      let queue = this.queues.get(guildId);

      // Verificar si hay una conexión existente válida
      if (queue?.connection && queue.voiceChannel.id === voiceChannel.id) {
        const connectionState = queue.connection.state.status;

        // Si la conexión está en un estado válido, reutilizarla
        if (
          connectionState !== VoiceConnectionStatus.Destroyed &&
          connectionState !== VoiceConnectionStatus.Disconnected
        ) {
          logger.info("Bot already connected to voice channel", {
            guildId,
            channelId: voiceChannel.id,
            connectionState,
          });
          return queue.connection;
        }

        // Si la conexión existe pero está en mal estado, limpiarla
        logger.info("Existing connection in bad state, cleaning up", {
          guildId,
          connectionState,
        });
      }

      // Limpiar cualquier conexión existente de forma segura
      if (queue?.connection) {
        this.safeDestroyConnection(queue.connection);
      }

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      if (!queue) {
        const player = createAudioPlayer();

        queue = {
          guildId,
          textChannel,
          voiceChannel,
          connection,
          player,
          songs: [],
          currentSong: null,
          isPlaying: false,
          isPaused: false,
          volume: 100,
          loopMode: "none",
          history: [],
        };

        this.queues.set(guildId, queue);
        this.setupPlayerEvents(guildId, player);

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            logger.info(
              "Voice connection disconnected, attempting to reconnect",
              {
                guildId,
                channelId: voiceChannel.id,
              },
            );

            await Promise.race([
              entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
              entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);

            logger.info("Voice connection successfully reconnected", {
              guildId,
            });
          } catch (error) {
            logger.warn("Failed to reconnect, clearing queue", {
              guildId,
              error: error instanceof Error ? error.message : String(error),
            });

            // Limpiar la cola sin intentar destruir la conexión otra vez
            // ya que está siendo manejada por el evento de desconexión
            const currentQueue = this.queues.get(guildId);
            if (currentQueue?.player) {
              currentQueue.player.stop();
            }
            this.queues.delete(guildId);
          }
        });

        connection.on("error", (error) => {
          logger.error("Voice connection error", {
            guildId,
            error: error.message,
            stack: error.stack,
          });

          // Limpiar la cola de forma segura
          const currentQueue = this.queues.get(guildId);
          if (currentQueue) {
            if (currentQueue.player) {
              currentQueue.player.stop();
            }
            // No destruir la conexión aquí ya que puede estar siendo manejada
            // por otros eventos
            this.queues.delete(guildId);
          }
        });
      } else {
        queue.connection = connection;
        queue.voiceChannel = voiceChannel;
        queue.textChannel = textChannel;
      }

      logger.info("Successfully joined voice channel", {
        guildId,
        channelId: voiceChannel.id,
        channelName: voiceChannel.name,
      });

      return connection;
    } catch (error) {
      logger.error("Error joining voice channel", {
        guildId,
        channelId: voiceChannel.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Desconecta el bot del canal de voz
   */
  async leave(guildId: string): Promise<void> {
    try {
      const queue = this.queues.get(guildId);

      if (!queue) {
        logger.warn("No queue found for guild when leaving", { guildId });
        return;
      }

      // Verificar si ya se está procesando una desconexión
      if (
        queue.connection &&
        queue.connection.state.status === VoiceConnectionStatus.Destroyed
      ) {
        logger.debug("Connection already destroyed, just cleaning up queue", {
          guildId,
        });
        this.safeCleanQueue(guildId);
        return;
      }

      // Detener el reproductor de forma segura
      if (queue.player) {
        queue.player.stop();
      }

      // Destruir la conexión de forma segura
      if (queue.connection) {
        this.safeDestroyConnection(queue.connection);
      }

      // Limpiar la cola de forma segura
      this.safeCleanQueue(guildId);

      logger.info("Successfully left voice channel", { guildId });
    } catch (error) {
      logger.error("Error leaving voice channel", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Asegurar que la cola se limpia incluso si hay errores
      this.safeCleanQueue(guildId);
      throw error;
    }
  }

  /**
   * Agrega canciones a la cola y reproduce si no está reproduciendo
   */
  async play(
    guildId: string,
    query: string,
    requester: { id: string; username: string },
  ): Promise<{ added: Song[]; playing: boolean }> {
    const queue = this.queues.get(guildId);
    if (!queue) {
      throw new Error("No hay una cola activa. Usa /join primero.");
    }

    try {
      logger.info("🎵 Iniciando búsqueda de música", {
        guildId,
        query,
        requester: requester.username,
      });

      const isPlaylist = query.includes("playlist");
      const wasPlaying = queue.isPlaying;

      if (isPlaylist) {
        logger.info(
          "🎵 Detectada playlist - iniciando streaming en tiempo real",
        );

        // Para playlists, procesar solo el primer lote e iniciar reproducción
        const initialSongs = await this.searchSongs(query, requester);

        logger.debug("Lote inicial de playlist completado", {
          guildId,
          foundSongs: initialSongs.length,
          firstSongTitle: initialSongs[0]?.title,
        });

        if (initialSongs.length === 0) {
          logger.warn("❌ No se encontraron resultados en lote inicial", {
            query,
          });
          throw new Error(
            "No se encontraron resultados iniciales para la playlist.",
          );
        }

        // Agregar solo las canciones iniciales
        queue.songs.push(...initialSongs);

        // Iniciar reproducción inmediatamente si no estaba reproduciendo
        if (!wasPlaying) {
          logger.info("🎶 Iniciando reproducción inmediata de playlist", {
            guildId,
          });
          await this.playNext(guildId);
        }

        logger.info(
          "✅ Playlist iniciada - procesando resto en segundo plano",
          {
            guildId,
            initialSongs: initialSongs.length,
            queueLength: queue.songs.length,
          },
        );

        // Enviar mensaje informativo al usuario
        if (queue.textChannel) {
          const embed = new (require("discord.js").EmbedBuilder)()
            .setColor(0x00ff00)
            .setTitle("🚀 Playlist Iniciada")
            .setDescription(
              `**${initialSongs.length}** canciones listas para reproducir\n` +
                `Las siguientes se cargarán automáticamente mientras escuchas`,
            )
            .setFooter({ text: "Sistema de buffer dinámico activado" });

          queue.textChannel.send({ embeds: [embed] }).catch(() => {});
        }

        return { added: initialSongs, playing: !wasPlaying };
      } else {
        // Para tracks individuales, usar método normal
        const songs = await this.searchSongs(query, requester);

        logger.debug("Búsqueda completada", {
          guildId,
          foundSongs: songs.length,
          firstSongTitle: songs[0]?.title,
        });

        if (songs.length === 0) {
          logger.warn("❌ No se encontraron resultados", { query });
          throw new Error("No se encontraron resultados para tu búsqueda.");
        }

        queue.songs.push(...songs);

        logger.debug("Estado de la cola", {
          guildId,
          totalSongsInQueue: queue.songs.length,
          wasAlreadyPlaying: wasPlaying,
        });

        if (!wasPlaying) {
          logger.info("🎶 Iniciando reproducción", { guildId });
          await this.playNext(guildId);
        }

        logger.info("✅ Canciones agregadas a la cola", {
          guildId,
          songCount: songs.length,
          wasPlaying,
          queueLength: queue.songs.length,
        });

        return { added: songs, playing: !wasPlaying };
      }
    } catch (error) {
      logger.error("💥 Error en play", {
        guildId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Busca canciones desde YouTube o Spotify
   */
  private async searchSongs(
    query: string,
    requester: { id: string; username: string },
  ): Promise<Song[]> {
    try {
      logger.info("🔍 Iniciando búsqueda de canciones", {
        query,
        requester: requester.username,
        queryLength: query.length,
        isUrl: query.includes("http"),
        isSpotify: query.includes("spotify.com"),
        isYoutube: query.includes("youtube.com") || query.includes("youtu.be"),
      });

      // Limpiar el query de caracteres especiales problemáticos para playlists
      const cleanQuery = this.cleanSearchQuery(query);
      logger.debug("Query limpio", {
        original: query,
        cleaned: cleanQuery,
      });

      // Verificar si es una URL de Spotify
      logger.info("🎵 Procesando query", { query, type: "checking_spotify" });

      const spotifyValidation = playdl.sp_validate(query);
      logger.debug("Spotify validation result", {
        query,
        validation: spotifyValidation,
      });

      if (spotifyValidation === "track") {
        logger.info("🎵 Detectado track de Spotify", { url: query });

        try {
          logger.debug("Obteniendo información del track de Spotify...");

          // Crear timeout para detectar si se cuelga
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Timeout: playdl.spotify() tardó más de 10 segundos",
                  ),
                ),
              10000,
            );
          });

          const spotifyInfo: any = await Promise.race([
            playdl.spotify(query),
            timeoutPromise,
          ]);

          logger.info("✅ Información de Spotify obtenida", {
            name: spotifyInfo.name,
            artist: spotifyInfo.artists?.[0]?.name,
            duration: spotifyInfo.durationInMs,
            external_url: spotifyInfo.external_urls?.spotify,
          });

          const searchQuery = `${spotifyInfo.name} ${spotifyInfo.artists?.[0]?.name || ""}`;
          logger.debug("🔍 Buscando en YouTube", { searchQuery });

          // Timeout para búsqueda en YouTube también
          const searchTimeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error("Timeout: YouTube search tardó más de 15 segundos"),
                ),
              15000,
            );
          });

          const searchResult: any = await Promise.race([
            playdl.search(searchQuery, {
              limit: 1,
              source: { youtube: "video" },
            }),
            searchTimeoutPromise,
          ]);

          logger.debug("Resultado de búsqueda en YouTube", {
            resultsFound: searchResult.length,
            firstResult: searchResult[0]
              ? {
                  title: searchResult[0].title,
                  url: searchResult[0].url,
                  duration: searchResult[0].durationInSec,
                }
              : null,
          });

          if (searchResult.length === 0) {
            logger.error("❌ No se encontraron resultados en YouTube", {
              searchQuery,
            });
            throw new Error("No se pudo encontrar la canción en YouTube.");
          }

          const video = searchResult[0];
          if (!video) {
            logger.error("❌ Video resultado es null/undefined");
            throw new Error("No se encontraron resultados.");
          }

          logger.info("✅ Spotify track convertido exitosamente", {
            spotifyTitle: spotifyInfo.name,
            youtubeTitle: video.title,
            youtubeUrl: video.url,
          });

          return [
            {
              title: video.title || "Título desconocido",
              url: video.url,
              duration: video.durationInSec || 0,
              thumbnail: video.thumbnails?.[0]?.url,
              requester,
            },
          ];
        } catch (error) {
          logger.error("💥 Error procesando track de Spotify", {
            query,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            isTimeout:
              error instanceof Error && error.message.includes("Timeout"),
            duration: Date.now(),
          });

          // Si es timeout, dar mensaje más específico
          if (error instanceof Error && error.message.includes("Timeout")) {
            throw new Error(`⏱️ Timeout procesando Spotify: ${error.message}`);
          }
          throw error;
        }
      }

      // Verificar si es una playlist de Spotify
      if (spotifyValidation === "playlist") {
        logger.info("🎵 Detectada playlist de Spotify", { url: query });

        // Procesar playlist con buffer dinámico
        return await this.processPlaylistWithDynamicBuffer(query, requester);
      }

      // Verificar si es una playlist de YouTube
      if (playdl.yt_validate(query) === "playlist") {
        const playlist = await playdl.playlist_info(query, {
          incomplete: true,
        });
        const videos = await playlist.all_videos();

        return videos
          .filter((video) => video !== undefined && video.url)
          .map((video) => ({
            title: video.title || "Título desconocido",
            url: video.url,
            duration: video.durationInSec || 0,
            thumbnail: video.thumbnails?.[0]?.url,
            requester,
          }));
      }

      // Verificar si es un video de YouTube
      if (playdl.yt_validate(query) === "video") {
        logger.debug("Detected YouTube video");

        try {
          const info = await playdl.video_basic_info(query);
          const video = info.video_details;

          if (!video) {
            throw new Error("No se pudo obtener información del video.");
          }

          logger.debug("YouTube video info retrieved", {
            title: video.title,
            id: video.id,
            duration: video.durationInSec,
          });

          return [
            {
              title: video.title || "Título desconocido",
              url: query, // Usar la query original en lugar de video.url
              duration: video.durationInSec || 0,
              thumbnail: video.thumbnails?.[0]?.url,
              requester,
            },
          ];
        } catch (error) {
          logger.error("Error getting video info, using direct URL", {
            query,
            error: error instanceof Error ? error.message : String(error),
          });

          // Si falla, usar la URL directamente
          return [
            {
              title: "Video de YouTube",
              url: query,
              duration: 0,
              thumbnail: undefined,
              requester,
            },
          ];
        }
      }

      // Buscar en YouTube
      logger.debug("Searching YouTube", { query: cleanQuery });
      const searchResult = await playdl.search(cleanQuery, {
        limit: 3,
        source: { youtube: "video" },
      });

      if (searchResult.length === 0) {
        logger.warn("No search results found", { query: cleanQuery });
        return [];
      }

      // Buscar el mejor resultado que no sea una playlist o stream en vivo
      let bestVideo = null;
      for (const video of searchResult) {
        if (!video || !video.url) continue;

        // Evitar playlists largas y streams en vivo
        if (video.durationInSec === 0 || video.durationInSec > 7200) {
          // Skip streams and videos > 2 hours
          logger.debug("Skipping long/live video", {
            title: video.title,
            duration: video.durationInSec,
          });
          continue;
        }

        bestVideo = video;
        break;
      }

      if (!bestVideo) {
        logger.warn("No suitable video found in search results", {
          query: cleanQuery,
        });
        return [];
      }

      logger.debug("Search result found", {
        title: bestVideo.title,
        url: bestVideo.url,
        duration: bestVideo.durationInSec,
      });

      return [
        {
          title: bestVideo.title || "Título desconocido",
          url: bestVideo.url,
          duration: bestVideo.durationInSec || 0,
          thumbnail: bestVideo.thumbnails?.[0]?.url,
          requester,
        },
      ];
    } catch (error) {
      logger.error("Error searching songs", {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Limpia queries de búsqueda de caracteres especiales y términos problemáticos
   */
  private cleanSearchQuery(query: string): string {
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
        } else if (query.toLowerCase().includes("chill")) {
          cleaned = "chill music";
        } else {
          cleaned = query; // Usar original si no podemos inferir
        }
      }

      logger.debug("Query cleaned", { original: query, cleaned });
      return cleaned;
    } catch (error) {
      logger.warn("Error cleaning search query", {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return query;
    }
  }

  /**
   * Usa yt-dlp para obtener información del video y stream URL
   */
  private async getVideoInfoWithYtDlp(url: string): Promise<{
    title: string;
    duration: number;
    streamUrl: string;
    thumbnail?: string;
  } | null> {
    try {
      logger.debug("Getting video info with yt-dlp", { url });

      // Get video info
      const info = await this.ytDlp.getVideoInfo(url);

      if (!info) {
        throw new Error("No video info returned from yt-dlp");
      }

      // Get best audio format URL
      const audioFormats =
        info.formats?.filter(
          (f: any) => f.acodec && f.acodec !== "none" && !f.vcodec,
        ) || [];

      if (audioFormats.length === 0) {
        // If no audio-only formats, get best format with audio
        const mixedFormats =
          info.formats?.filter((f: any) => f.acodec && f.acodec !== "none") ||
          [];

        if (mixedFormats.length === 0) {
          throw new Error("No audio formats available");
        }

        const bestMixed = mixedFormats.sort(
          (a: any, b: any) => (b.abr || 0) - (a.abr || 0),
        )[0];

        return {
          title: info.title || "Unknown Title",
          duration: parseInt(info.duration) || 0,
          streamUrl: bestMixed.url,
          thumbnail: info.thumbnail,
        };
      }

      const bestAudio = audioFormats.sort(
        (a: any, b: any) => (b.abr || 0) - (a.abr || 0),
      )[0];

      return {
        title: info.title || "Unknown Title",
        duration: parseInt(info.duration) || 0,
        streamUrl: bestAudio.url,
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

  /**
   * Usa yt-dlp para obtener stream de audio directamente
   */
  private async getDirectAudioStreamWithYtDlp(url: string): Promise<any> {
    try {
      logger.debug("Getting audio stream with yt-dlp + ffmpeg", { url });

      return new Promise((resolve, reject) => {
        const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");
        const ffmpegPath = process.env.FFMPEG_PATH;

        if (!ffmpegPath) {
          reject(new Error("ffmpeg not found"));
          return;
        }

        // yt-dlp process
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

        // ffmpeg process para procesar el audio como PCM con throttling
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
          "1", // Usar un solo hilo para reducir velocidad de procesamiento
          "-preset",
          "slow", // Procesamiento más lento pero estable
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
        }, 15000);

        ffmpegProcess.stdout.once("data", () => {
          hasData = true;
          clearTimeout(timeout);
          logger.debug("ffmpeg processed stream ready", { url });

          // Crear throttle stream para controlar flujo
          const { Transform } = require("stream");
          const throttleStream = new Transform({
            transform(chunk: any, encoding: any, callback: any) {
              // Permitir chunks más pequeños para flujo constante
              if (chunk.length > 8192) {
                // 8KB chunks
                let offset = 0;
                const pushChunk = () => {
                  if (offset < chunk.length) {
                    const nextChunk = chunk.slice(offset, offset + 8192);
                    offset += 8192;
                    this.push(nextChunk);
                    // Pequeño delay para evitar saturación
                    setTimeout(pushChunk, 5);
                  } else {
                    callback();
                  }
                };
                pushChunk();
              } else {
                this.push(chunk);
                callback();
              }
            },
          });

          ffmpegProcess.stdout.pipe(throttleStream);
          resolve(throttleStream);
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
    } catch (error) {
      logger.error("Error creating yt-dlp + ffmpeg stream", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Limpia y valida URLs problemáticas
   */
  private cleanUrl(url: string): string {
    try {
      // Limpiar caracteres especiales problemáticos
      let cleanedUrl = url.trim();

      // Si es una URL de YouTube, extraer el ID del video
      const youtubeRegex =
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
      const match = cleanedUrl.match(youtubeRegex);

      if (match && match[1]) {
        const videoId = match[1];
        cleanedUrl = `https://www.youtube.com/watch?v=${videoId}`;
        logger.debug("URL cleaned and normalized", {
          original: url,
          cleaned: cleanedUrl,
          videoId,
        });
      }

      return cleanedUrl;
    } catch (error) {
      logger.warn("Error cleaning URL, using original", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return url;
    }
  }

  /**
   * Reproduce la siguiente canción en la cola
   */
  /**
   * Usa yt-dlp como fallback para obtener audio de YouTube
   */
  private async getAudioStreamWithYtDlp(
    song: Song,
    guildId: string,
  ): Promise<any> {
    try {
      logger.debug("Attempting yt-dlp fallback", { guildId, url: song.url });

      // Crear un archivo temporal para el audio
      const tempDir = path.join(process.cwd(), "temp");
      const tempFile = path.join(
        tempDir,
        `audio_${guildId}_${Date.now()}.%(ext)s`,
      );

      // Asegurar que el directorio temp existe
      const fs = await import("fs");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Usar yt-dlp para descargar solo el audio
      await this.ytDlp.execPromise([
        song.url,
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "192K",
        "--output",
        tempFile,
        "--no-playlist",
        "--quiet",
        "--extractor-args",
        "youtube:player_client=default",
      ]);

      // Encontrar el archivo descargado
      const files = fs.readdirSync(tempDir);
      const audioFile = files.find(
        (file) =>
          file.startsWith(`audio_${guildId}`) &&
          (file.endsWith(".mp3") ||
            file.endsWith(".m4a") ||
            file.endsWith(".webm")),
      );

      if (!audioFile) {
        throw new Error("yt-dlp no pudo descargar el archivo de audio");
      }

      const fullPath = path.join(tempDir, audioFile);
      logger.debug("yt-dlp audio file created", { guildId, file: fullPath });

      // Crear stream desde el archivo temporal
      const stream = createReadStream(fullPath);

      // Programar eliminación del archivo después de un tiempo
      setTimeout(async () => {
        try {
          await unlink(fullPath);
          logger.debug("Temporary audio file cleaned up", { file: fullPath });
        } catch (error) {
          logger.warn("Failed to clean up temporary file", {
            file: fullPath,
            error,
          });
        }
      }, 300000); // 5 minutos

      return stream;
    } catch (error) {
      logger.error("yt-dlp fallback failed", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Crea un AudioResource compatible evitando problemas de Opus
   */
  private createCompatibleAudioResource(stream: any, guildId: string): any {
    logger.debug("Starting AudioResource creation", {
      guildId,
      streamType: typeof stream,
      streamReadable: stream?.readable,
      streamConstructor: stream?.constructor?.name,
    });

    try {
      // Como ya procesamos con ffmpeg a PCM, usar configuración específica
      logger.debug("Creating AudioResource for PCM stream", { guildId });

      const resource = createAudioResource(stream, {
        inlineVolume: false,
        inputType: StreamType.Raw, // El stream está en formato PCM raw
        metadata: {
          title: `Audio stream for ${guildId}`,
        },
      });

      logger.debug("PCM AudioResource created successfully", {
        guildId,
        resourceType: typeof resource,
        hasPlayStream: resource?.playStream !== undefined,
        playStreamReadable: resource?.playStream?.readable,
      });

      return resource;
    } catch (pcmError) {
      logger.warn("PCM AudioResource creation failed, trying alternatives", {
        guildId,
        error: pcmError instanceof Error ? pcmError.message : String(pcmError),
      });

      // Fallback a auto-detección
      try {
        const resource = createAudioResource(stream, {
          inlineVolume: false,
          inputType: StreamType.Arbitrary,
        });
        logger.debug("Arbitrary AudioResource created successfully", {
          guildId,
        });
        return resource;
      } catch (arbitraryError) {
        logger.warn("Arbitrary AudioResource creation failed", { guildId });

        // Último recurso: sin especificar tipo
        const resource = createAudioResource(stream, {
          inlineVolume: false,
        });
        logger.debug("Fallback AudioResource created", { guildId });
        return resource;
      }
    }
  }

  /**
   * Obtiene el stream de audio detectando automáticamente la fuente
   */
  private async getAudioStream(song: Song, guildId: string): Promise<any> {
    // Detectar la fuente basada en la URL
    const isSpotify = song.url.includes("spotify.com");
    const isYouTube =
      song.url.includes("youtube.com") || song.url.includes("youtu.be");

    logger.debug("Detecting audio source", {
      guildId,
      url: song.url,
      isSpotify,
      isYouTube,
    });

    // Para Spotify: usar play-dl
    if (isSpotify) {
      logger.debug("Using play-dl for Spotify", { guildId });
      try {
        const qualities = [2, 1, 0];
        for (const quality of qualities) {
          try {
            logger.debug(`Attempting play-dl stream with quality ${quality}`, {
              guildId,
              url: song.url,
            });

            // Validate URL before streaming
            if (!song.url || typeof song.url !== "string") {
              throw new Error(`Invalid URL: ${song.url}`);
            }

            // Add timeout using configuration
            const streamPromise = playdl.stream(song.url, { quality });
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(
                () =>
                  reject(new Error(`Stream timeout for quality ${quality}`)),
                this.config.streamTimeoutMs,
              );
            });

            const stream: any = await Promise.race([
              streamPromise,
              timeoutPromise,
            ]);

            // Validate stream response
            if (!stream) {
              throw new Error(`Stream is null for quality ${quality}`);
            }

            if (!stream.stream) {
              throw new Error(`Stream.stream is null for quality ${quality}`);
            }

            // Additional validation for stream readability
            if (stream.stream.destroyed) {
              throw new Error(
                `Stream is already destroyed for quality ${quality}`,
              );
            }

            logger.info("Spotify stream obtained with play-dl", {
              guildId,
              quality,
              streamType: stream.type || "unknown",
              hasStream: !!stream.stream,
            });
            return stream.stream;
          } catch (error) {
            logger.debug(`Play-dl quality ${quality} failed`, {
              guildId,
              error: error instanceof Error ? error.message : String(error),
              isFormatError:
                error instanceof Error && error.message.includes("format"),
              isTimeout:
                error instanceof Error && error.message.includes("timeout"),
            });

            // Wait between quality attempts using configuration
            await new Promise((resolve) =>
              setTimeout(resolve, this.config.rateLimitDelayMs),
            );
          }
        }
        throw new Error("All play-dl qualities failed for Spotify");
      } catch (error) {
        logger.error("Play-dl failed for Spotify", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Para YouTube: usar yt-dlp
    if (isYouTube) {
      logger.debug("Using yt-dlp for YouTube", { guildId });
      try {
        const stream = await this.getDirectAudioStreamWithYtDlp(song.url);
        logger.info("YouTube stream obtained with yt-dlp", { guildId });
        return stream;
      } catch (error) {
        logger.warn("Direct yt-dlp failed, trying with video info", {
          guildId,
        });

        try {
          const videoInfo = await this.getVideoInfoWithYtDlp(song.url);
          if (videoInfo) {
            // Update song info
            song.title = videoInfo.title;
            song.duration = videoInfo.duration;
            song.thumbnail = videoInfo.thumbnail || song.thumbnail;

            // Use the stream URL from yt-dlp
            const https = await import("https");
            const stream = await new Promise<any>((resolve, reject) => {
              https
                .get(videoInfo.streamUrl, (response) => {
                  if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                  }
                  resolve(response);
                })
                .on("error", reject);
            });

            logger.info("YouTube stream obtained with yt-dlp video info", {
              guildId,
            });
            return stream;
          }
        } catch (videoInfoError) {
          logger.error("yt-dlp video info also failed", {
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

    // Para búsquedas (no es URL directa): buscar en YouTube y usar yt-dlp
    logger.debug("Searching on YouTube for query", {
      guildId,
      query: song.title,
    });
    try {
      const cleanTitle = this.cleanSearchQuery(song.title);
      const searchResult = await playdl.search(cleanTitle, {
        limit: 5,
        source: { youtube: "video" },
      });

      if (searchResult.length === 0) {
        throw new Error("No search results found");
      }

      for (let i = 0; i < Math.min(searchResult.length, 3); i++) {
        const video = searchResult[i];
        if (
          !video?.url ||
          video.durationInSec === 0 ||
          video.durationInSec > 7200
        ) {
          continue; // Skip live streams and very long videos
        }

        try {
          // Use yt-dlp for search results (YouTube videos)
          const stream = await this.getDirectAudioStreamWithYtDlp(video.url);
          logger.info("Search result stream obtained with yt-dlp", {
            guildId,
            resultIndex: i + 1,
            newTitle: video.title,
          });

          // Update song info
          song.url = video.url;
          song.title = video.title || song.title;
          song.duration = video.durationInSec || song.duration;
          song.thumbnail = video.thumbnails?.[0]?.url || song.thumbnail;

          return stream;
        } catch (error) {
          logger.debug(`Search result ${i + 1} failed`, {
            guildId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      throw new Error("All search results failed");
    } catch (searchError) {
      logger.error("Search strategy failed", {
        guildId,
        error:
          searchError instanceof Error
            ? searchError.message
            : String(searchError),
      });
      throw searchError;
    }
  }

  private async playNext(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.player || !queue.connection) return;

    if (queue.songs.length === 0) {
      queue.isPlaying = false;
      queue.currentSong = null;
      logger.info("Queue finished", { guildId });
      return;
    }

    const song = queue.songs.shift()!;

    try {
      logger.info("Starting playback process", {
        guildId,
        title: song.title,
        url: song.url,
        queueLength: queue.songs.length,
      });
      logger.debug("Attempting to play song", {
        guildId,
        title: song.title,
        url: song.url,
      });

      // Limpiar la URL antes de procesarla
      const cleanedUrl = this.cleanUrl(song.url);
      song.url = cleanedUrl;

      // Validar según la plataforma
      const isSpotify = song.url.includes("spotify.com");
      const isYouTube =
        song.url.includes("youtube.com") || song.url.includes("youtu.be");

      if (isYouTube) {
        const validateResult = playdl.yt_validate(song.url);
        logger.debug("YouTube URL validation", {
          guildId,
          url: song.url,
          validateResult,
        });

        if (validateResult !== "video") {
          throw new Error(
            `URL de YouTube no es un video válido (tipo: ${validateResult}): ${song.url}`,
          );
        }
      } else if (isSpotify) {
        logger.debug("Spotify URL detected", {
          guildId,
          url: song.url,
        });
      } else {
        // Para búsquedas/otros casos, no validar URL
        logger.debug("Search query or other URL type", {
          guildId,
          query: song.url,
        });
      }

      logger.debug("Attempting to get audio stream", {
        guildId,
        url: song.url,
      });

      // Usar la nueva función auxiliar para obtener el stream
      // Asegurar conexión estable antes de obtener stream
      await this.ensureConnectionReady(queue, guildId);

      // Obtener stream con retry automático
      const stream = await this.getAudioStreamWithRetry(song, guildId);

      logger.debug("Stream obtained successfully", {
        guildId,
        streamType: typeof stream,
        hasReadable: stream?.readable !== undefined,
        hasDestroy: typeof stream?.destroy === "function",
        streamConstructor: stream?.constructor?.name,
      });

      const resource = this.createCompatibleAudioResource(stream, guildId);

      logger.debug("Audio resource created", {
        guildId,
        resourceType: typeof resource,
        hasPlayStream: resource?.playStream !== undefined,
        resourceState: resource?.playStream?.readable,
      });

      logger.info("About to play audio resource", {
        guildId,
        playerState: queue.player.state.status,
        connectionState: queue.connection.state.status,
        resourceReady: resource !== null,
      });

      // Verificar estados antes de reproducir
      if (queue.connection?.state.status !== VoiceConnectionStatus.Ready) {
        logger.warn("Voice connection not ready", {
          guildId,
          connectionState: queue.connection.state.status,
        });
      }

      queue.player.play(resource);

      // Verificar que el player esté suscrito a la conexión
      const subscription = queue.connection.subscribe(queue.player);

      logger.debug("Player subscription result", {
        guildId,
        subscriptionExists: subscription !== undefined,
        playerStateAfterPlay: queue.player.state.status,
      });

      queue.currentSong = song;
      queue.isPlaying = true;
      queue.isPaused = false;

      // Log volume info since inline volume is disabled
      logger.debug("Audio playback started", {
        guildId,
        inlineVolumeDisabled: true,
        volumeControl: "Use Discord client volume or bot commands",
      });

      if (queue.loopMode !== "song") {
        queue.history.push(song);
        if (queue.history.length > 10) {
          queue.history.shift();
        }
      }

      // Dar un momento para que el player procese el recurso
      setTimeout(() => {
        logger.info("Player state after play command", {
          guildId,
          playerState: queue.player?.state.status,
          connectionState: queue.connection?.state.status,
        });
      }, 100);

      logger.info("Now playing", {
        guildId,
        title: song.title,
        url: song.url,
      });

      // Enviar mensaje al canal de texto
      if (queue.textChannel) {
        const embed = new (await import("discord.js")).EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🎵 Reproduciendo Ahora")
          .setDescription(`**${song.title}**`)
          .setURL(song.url);

        if (song.thumbnail) {
          embed.setThumbnail(song.thumbnail);
        }

        await queue.textChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {
      logger.error("Error playing song", {
        guildId,
        song: song.title,
        url: song.url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Enviar mensaje de error al canal si está disponible
      if (queue.textChannel) {
        const embed = new (await import("discord.js")).EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Error al reproducir")
          .setDescription(
            `No se pudo reproducir: **${song.title}**\n\`\`\`${error instanceof Error ? error.message : String(error)}\`\`\``,
          )
          .addFields([{ name: "URL", value: song.url, inline: false }]);

        await queue.textChannel.send({ embeds: [embed] }).catch(() => {});
      }

      // Solo intentar con la siguiente canción si hay más canciones en la cola
      if (queue.songs.length > 0) {
        logger.info("Attempting next song after error", {
          guildId,
          remainingSongs: queue.songs.length,
        });
        await this.playNext(guildId);
      } else {
        logger.info("No more songs to play after error", { guildId });
        queue.isPlaying = false;
        queue.currentSong = null;
      }
    }
  }

  /**
   * Configura eventos del reproductor
   */
  private setupPlayerEvents(guildId: string, player: AudioPlayer): void {
    player.on(AudioPlayerStatus.Idle, async () => {
      logger.debug("Player went to Idle state", { guildId });
      const queue = this.queues.get(guildId);
      if (!queue) return;

      if (queue.loopMode === "song" && queue.currentSong) {
        logger.debug("Looping current song", { guildId });
        queue.songs.unshift(queue.currentSong);
      } else if (queue.loopMode === "queue" && queue.currentSong) {
        logger.debug("Adding song to end of queue", { guildId });
        queue.songs.push(queue.currentSong);
      }

      await this.playNext(guildId);
    });

    player.on(AudioPlayerStatus.Playing, () => {
      logger.info("Player started playing", {
        guildId,
        playerState: player.state.status,
      });
    });

    player.on(AudioPlayerStatus.Buffering, () => {
      logger.debug("Player is buffering", { guildId });
    });

    player.on(AudioPlayerStatus.Paused, () => {
      logger.debug("Player was paused", { guildId });
    });

    player.on(AudioPlayerStatus.AutoPaused, () => {
      logger.warn("Player was auto-paused", { guildId });
    });

    player.on("error", (error) => {
      logger.error("Audio player error", {
        guildId,
        error: error.message,
        stack: error.stack,
        playerState: player.state.status,
      });
    });

    // Escuchar cambios de estado
    player.on("stateChange", (oldState, newState) => {
      logger.info("Player state changed", {
        guildId,
        from: oldState.status,
        to: newState.status,
      });

      // Si hay un error en el recurso
      if (
        newState.status === AudioPlayerStatus.Idle &&
        (newState as any).reason === "error"
      ) {
        logger.error("Player idle due to resource error", {
          guildId,
          error:
            (newState as any).resource?.metadata?.error ||
            "Unknown resource error",
        });
      }

      // Cuando una canción termina, verificar buffer
      if (newState.status === AudioPlayerStatus.Idle) {
        this.checkAndRefillBuffer(guildId).catch((error) => {
          logger.error("Error checking buffer after song end", {
            guildId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    });
  }

  /**
   * Pausa la reproducción
   */
  pause(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.player || !queue.isPlaying) return false;

    const paused = queue.player.pause();
    if (paused) {
      queue.isPaused = true;
      logger.info("Playback paused", { guildId });
    }
    return paused;
  }

  /**
   * Reanuda la reproducción
   */
  resume(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.player || !queue.isPaused) return false;

    const resumed = queue.player.unpause();
    if (resumed) {
      queue.isPaused = false;
      logger.info("Playback resumed", { guildId });
    }
    return resumed;
  }

  /**
   * Detiene la reproducción y limpia la cola
   */
  stop(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.player) return false;

    queue.player.stop();
    queue.songs = [];
    queue.currentSong = null;
    queue.isPlaying = false;
    queue.isPaused = false;

    logger.info("Playback stopped", { guildId });
    return true;
  }

  /**
   * Salta a la siguiente canción
   */
  async skip(guildId: string): Promise<boolean> {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.player || !queue.isPlaying) return false;

    queue.player.stop();
    logger.info("Song skipped", { guildId });
    return true;
  }

  /**
   * Elimina una canción de la cola
   */
  removeSong(guildId: string, index: number): Song | null {
    const queue = this.queues.get(guildId);
    if (!queue || index < 1 || index > queue.songs.length) return null;

    const removed = queue.songs.splice(index - 1, 1)[0];
    if (!removed) return null;

    logger.info("Song removed from queue", {
      guildId,
      index,
      title: removed.title,
    });
    return removed;
  }

  /**
   * Limpia la cola sin detener la canción actual
   */
  clearSongs(guildId: string): number {
    const queue = this.queues.get(guildId);
    if (!queue) return 0;

    const count = queue.songs.length;
    queue.songs = [];

    logger.info("Queue cleared", { guildId, clearedCount: count });
    return count;
  }

  /**
   * Mezcla la cola aleatoriamente
   */
  shuffle(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || queue.songs.length < 2) return false;

    for (let i = queue.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = queue.songs[i];
      const other = queue.songs[j];
      if (temp && other) {
        queue.songs[i] = other;
        queue.songs[j] = temp;
      }
    }

    logger.info("Queue shuffled", { guildId, songCount: queue.songs.length });
    return true;
  }

  /**
   * Ajusta el volumen
   */
  setVolume(guildId: string, volume: number): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;

    queue.volume = Math.max(0, Math.min(200, volume));

    // Aplicar volumen inmediatamente si hay algo reproduciéndose
    if (queue.player && queue.isPlaying) {
      const state = queue.player.state;
      if (
        state.status === "playing" &&
        "resource" in state &&
        state.resource.volume
      ) {
        state.resource.volume.setVolume(queue.volume / 100);
        logger.info("Inline volume changed", { guildId, volume: queue.volume });
        return true;
      } else {
        logger.warn(
          "Inline volume not available - using Discord client volume",
          {
            guildId,
            requestedVolume: queue.volume,
            reason: "inlineVolume disabled to avoid Opus encoding issues",
          },
        );
      }
    }

    // Store volume for future playback
    logger.info("Volume preference stored", {
      guildId,
      volume: queue.volume,
      note: "Will apply to new songs (use Discord client for current song)",
    });
    return true;
  }

  /**
   * Configura el modo de repetición
   */
  setLoop(guildId: string, mode: LoopMode): boolean {
    const queue = this.queues.get(guildId);
    if (!queue) return false;

    queue.loopMode = mode;
    logger.info("Loop mode changed", { guildId, mode });
    return true;
  }

  /**
   * Obtiene la cola de un servidor
   */
  getQueue(guildId: string): MusicQueue | undefined {
    return this.queues.get(guildId);
  }

  /**
   * Limpia y elimina la cola de un servidor
   */
  clearQueue(guildId: string): void {
    const queue = this.queues.get(guildId);

    if (queue) {
      if (queue.player) {
        queue.player.stop();
      }

      if (queue.connection) {
        this.safeDestroyConnection(queue.connection);
      }

      this.queues.delete(guildId);

      logger.info("Queue cleared", { guildId });
    }
  }

  /**
   * Limpia la cola de forma segura sin intentar destruir conexiones ya destruidas
   */
  private safeCleanQueue(guildId: string): void {
    const queue = this.queues.get(guildId);

    if (!queue) {
      return;
    }

    // Detener el reproductor de forma segura
    if (queue.player) {
      try {
        queue.player.stop();
      } catch (error) {
        logger.debug("Player already stopped", { guildId });
      }
    }

    // Solo eliminar de la cola, no destruir la conexión aquí
    this.queues.delete(guildId);

    logger.debug("Queue safely cleaned", { guildId });
  }

  /**
   * Limpia la cola cuando la conexión ya está destruida (para uso en eventos)
   */
  cleanQueueAfterDisconnect(guildId: string): void {
    const queue = this.queues.get(guildId);

    if (!queue) {
      return;
    }

    // Detener el reproductor de forma segura
    if (queue.player) {
      try {
        queue.player.stop();
      } catch (error) {
        logger.debug("Player already stopped during disconnect cleanup", {
          guildId,
        });
      }
    }

    // Solo eliminar de la cola, la conexión ya está siendo manejada por Discord
    this.queues.delete(guildId);

    logger.info("Queue cleaned after voice disconnect", { guildId });
  }

  /**
   * Destruye una conexión de voz de forma segura, verificando su estado primero
   */
  private safeDestroyConnection(connection: VoiceConnection): void {
    try {
      const currentState = connection.state.status;

      if (currentState === VoiceConnectionStatus.Destroyed) {
        logger.debug("Connection already destroyed, skipping destruction");
        return;
      }

      logger.debug("Destroying voice connection", {
        currentState,
        connectionId: connection.joinConfig.channelId,
      });

      connection.destroy();
    } catch (error) {
      logger.warn("Error while destroying connection", {
        error: error instanceof Error ? error.message : String(error),
        connectionState: connection.state.status,
      });
    }
  }

  /**
   * Obtiene todas las colas activas
   */
  getAllQueues(): Map<string, MusicQueue> {
    return this.queues;
  }

  // Método auxiliar para retry de streams
  private async getAudioStreamWithRetry(
    song: Song,
    guildId: string,
    maxRetries: number = this.config.maxStreamRetries,
  ): Promise<Readable> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Stream attempt ${attempt}/${maxRetries}`, {
          guildId,
          song: song.title,
        });

        const stream = await this.getAudioStream(song, guildId);

        // Verificar que el stream es válido
        if (!stream || !stream.readable) {
          throw new Error(`Stream is not readable (attempt ${attempt})`);
        }

        logger.info(`Stream obtained successfully on attempt ${attempt}`, {
          guildId,
        });

        return stream;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Stream attempt ${attempt} failed`, {
          guildId,
          error: lastError.message,
          willRetry: attempt < maxRetries,
        });

        // Pausa progresiva entre reintentos usando configuración
        if (attempt < maxRetries) {
          const delay = attempt * this.config.searchRetryDelay; // Progresivo basado en config
          logger.debug(MUSIC_MESSAGES.STREAM_RETRY(attempt + 1, maxRetries));
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to get audio stream after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  // Método auxiliar para asegurar conexión estable
  private async ensureConnectionReady(
    queue: MusicQueue,
    guildId: string,
  ): Promise<void> {
    if (!queue.connection) {
      throw new Error("No voice connection available");
    }

    // Si la conexión no está lista, esperar hasta 5 segundos
    if (queue.connection.state.status !== VoiceConnectionStatus.Ready) {
      logger.debug("Waiting for connection to be ready", {
        guildId,
        currentStatus: queue.connection.state.status,
      });

      try {
        logger.debug(MUSIC_MESSAGES.CONNECTION_WAIT, { guildId });
        await entersState(
          queue.connection,
          VoiceConnectionStatus.Ready,
          this.config.connectionTimeoutMs,
        );
        logger.debug("Connection is now ready", { guildId });
      } catch (error) {
        logger.warn("Connection did not become ready in time", {
          guildId,
          finalStatus: queue.connection.state.status,
        });
        // Continuar de todos modos, puede funcionar
      }
    }
  }

  /**
   * Procesa playlist de Spotify con buffer dinámico de 3 canciones
   */
  private async processPlaylistWithDynamicBuffer(
    playlistUrl: string,
    requester: { id: string; username: string },
  ): Promise<Song[]> {
    try {
      logger.debug("Obteniendo información de la playlist...");

      // Obtener info de la playlist
      const playlist: any = await playdl.spotify(playlistUrl);

      logger.info("✅ Información de playlist obtenida", {
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.total_tracks,
        owner: playlist.owner?.display_name,
      });

      // Obtener todos los tracks
      const allTracks = [];
      for (const track of playlist.page(1)) {
        allTracks.push(track);
      }

      // Configuración optimizada
      const optimalConfig = getOptimalConfig(allTracks.length);
      const tracksToProcess = allTracks.slice(
        0,
        optimalConfig.maxPlaylistTracks,
      );

      if (allTracks.length > optimalConfig.maxPlaylistTracks) {
        logger.info(
          MUSIC_MESSAGES.PLAYLIST_TOO_LARGE(
            allTracks.length,
            optimalConfig.maxPlaylistTracks,
          ),
        );
      }

      // Procesar solo las primeras 3 canciones
      const BUFFER_SIZE = 3;
      const initialBatch = tracksToProcess.slice(0, BUFFER_SIZE);

      logger.info("🚀 Procesando buffer inicial de 3 canciones...");

      // Procesar buffer inicial
      const initialSongs = await this.processBatchOfTracks(
        initialBatch,
        requester,
        optimalConfig,
        1,
        1,
      );

      logger.info(
        `✅ Buffer inicial procesado: ${initialSongs.length} tracks listos`,
      );

      // Configurar buffer dinámico para esta playlist
      this.setupDynamicBuffer(
        tracksToProcess,
        requester,
        optimalConfig,
        BUFFER_SIZE,
      );

      return initialSongs;
    } catch (error) {
      logger.error("💥 Error procesando playlist de Spotify", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Procesa un lote de tracks
   */
  private async processBatchOfTracks(
    tracks: any[],
    requester: { id: string; username: string },
    config: MusicConfig,
    batchNumber: number,
    totalBatches: number,
  ): Promise<Song[]> {
    const songs: Song[] = [];

    logger.debug(`🔄 Procesando lote ${batchNumber}/${totalBatches}...`);

    const batchPromises = tracks.map(async (track, trackIndex) => {
      try {
        const searchQuery = `${track.name} ${track.artists?.[0]?.name || ""}`;

        logger.debug(`Buscando: ${track.name}`);

        const searchPromise = playdl.search(searchQuery, {
          limit: 1,
          source: { youtube: "video" },
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Timeout")),
            config.searchTimeoutMs,
          );
        });

        const searchResult: any = await Promise.race([
          searchPromise,
          timeoutPromise,
        ]);

        if (searchResult.length > 0) {
          const video = searchResult[0];
          if (video && video.url) {
            logger.debug(`✅ Encontrado: ${video.title}`);
            return {
              title: video.title || "Título desconocido",
              url: video.url,
              duration: video.durationInSec || 0,
              thumbnail: video.thumbnails?.[0]?.url,
              requester,
            };
          }
        }

        logger.debug(`❌ Sin resultados para: ${track.name}`);
        return null;
      } catch (error) {
        logger.debug(`💥 Error buscando: ${track.name}`);
        return null;
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        songs.push(result.value);
      }
    });

    return songs;
  }

  /**
   * Configura buffer dinámico para una playlist
   */
  private setupDynamicBuffer(
    allTracks: any[],
    requester: { id: string; username: string },
    config: MusicConfig,
    bufferSize: number,
  ): void {
    // Guardar información del buffer en el estado del servicio
    const bufferKey = `${requester.id}_${Date.now()}_playlist_buffer`;

    // Crear objeto de estado del buffer
    const bufferState = {
      allTracks,
      requester,
      config,
      bufferSize,
      currentIndex: bufferSize, // Empezamos desde índice 3 (ya procesamos 0,1,2)
      isProcessing: false,
    };

    // Guardamos el estado
    this.playlistBuffers.set(bufferKey, bufferState);

    logger.info("🔧 Buffer dinámico configurado", {
      totalTracks: allTracks.length,
      bufferSize,
      remainingTracks: allTracks.length - bufferSize,
      requester: requester.username,
    });
  }

  /**
   * Agrega canciones a la cola activa del guild del requester
   */
  private addSongsToActiveQueue(
    songs: Song[],
    requester: { id: string; username: string },
  ): void {
    // Encontrar la cola activa del usuario
    for (const [guildId, queue] of this.queues) {
      // Verificar si el usuario está en esta cola revisando las canciones existentes
      const userInQueue = queue.songs.some(
        (song) => song.requester.id === requester.id,
      );

      if (userInQueue) {
        queue.songs.push(...songs);
        logger.info("➕ Canciones agregadas desde segundo plano", {
          guildId,
          addedCount: songs.length,
          totalInQueue: queue.songs.length,
        });

        return;
      }
    }

    logger.debug("No active queue found for background songs", {
      requesterId: requester.id,
    });
  }

  /**
   * Verifica y rellena el buffer dinámico cuando sea necesario
   */
  private async checkAndRefillBuffer(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    // Buscar buffer activo asociado con este guild
    const bufferKey = Array.from(this.playlistBuffers.keys()).find((key) => {
      const bufferState = this.playlistBuffers.get(key);
      if (!bufferState) return false;

      // Verificar si hay canciones de este requester en la cola del guild
      return queue.songs.some(
        (song) => song.requester.id === bufferState.requester.id,
      );
    });

    if (!bufferKey) return;

    const bufferState = this.playlistBuffers.get(bufferKey);
    if (!bufferState || bufferState.isProcessing) return;

    // Verificar si necesitamos más canciones (menos de 3 en cola)
    const songsAhead = queue.songs.length;

    if (
      songsAhead < bufferState.bufferSize &&
      bufferState.currentIndex < bufferState.allTracks.length
    ) {
      logger.info(`🔄 Buffer bajo (${songsAhead} canciones), recargando...`, {
        guildId,
        currentBuffer: songsAhead,
        nextTrackIndex: bufferState.currentIndex,
      });

      bufferState.isProcessing = true;

      try {
        // Procesar siguiente canción
        const nextTrack = bufferState.allTracks[bufferState.currentIndex];
        if (nextTrack) {
          const nextSongs = await this.processBatchOfTracks(
            [nextTrack],
            bufferState.requester,
            bufferState.config,
            bufferState.currentIndex + 1,
            bufferState.allTracks.length,
          );

          if (nextSongs.length > 0) {
            // Agregar directamente a la cola del guild actual
            queue.songs.push(...nextSongs);
            logger.debug(`✅ Buffer rellenado: +${nextSongs.length} canción`, {
              guildId,
              currentBuffer: queue.songs.length,
              trackName: nextSongs[0]?.title || "Unknown",
            });
          }

          bufferState.currentIndex++;
        }

        // Si terminamos todos los tracks, limpiar buffer
        if (bufferState.currentIndex >= bufferState.allTracks.length) {
          this.playlistBuffers.delete(bufferKey);
          logger.info("🎉 Playlist completamente procesada, buffer eliminado", {
            guildId,
            totalProcessed: bufferState.currentIndex,
          });
        }
      } catch (error) {
        logger.error("Error recargando buffer", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        bufferState.isProcessing = false;
      }
    }
  }
}

const musicService = new MusicService();
export default musicService;
