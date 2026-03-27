/**
 * PlayerService - Control de reproducción de audio
 * 
 * Responsabilidades:
 * - Iniciar/detener reproducción (play/stop)
 * - Pause/resume/skip
 * - Ajuste de volumen
 * - Eventos de playback (Started, Ended, Error)
 * - Integración con VoiceConnectionService
 * 
 * Este servicio forma parte de la arquitectura de servicios de música:
 * - VoiceConnectionService: conexiones de voz
 * - AudioStreamService: resolución y stream de audio
 * - QueueManagementService: gestión de colas
 * - PlayerService: control de reproducción
 */

import { Readable } from "stream";
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import type { VoiceSession, Song, PlaybackResult, PlaybackError, PlaybackErrorCode, PlaybackStartedEvent, PlaybackEndedEvent, PlaybackErrorEvent, StreamOptions } from "./types";
import logger from "../../../utils/logger";
import { DEFAULT_MUSIC_CONFIG } from "../../../config/music";

// ============================================================================
// Tipos internos
// ============================================================================

interface PlayerState {
  guildId: string;
  player: AudioPlayer;
  currentSong: Song | null;
  currentResource: AudioResource | null;
  volume: number;
  isPlaying: boolean;
  isPaused: boolean;
}

interface EventHandlers {
  onPlaybackStarted?: (event: PlaybackStartedEvent) => void;
  onPlaybackEnded?: (event: PlaybackEndedEvent) => void;
  onPlaybackError?: (event: PlaybackErrorEvent) => void;
}

// ============================================================================
// PlayerService - Implementación
// ============================================================================

class PlayerServiceImpl {
  private players = new Map<string, PlayerState>();
  private eventHandlers: EventHandlers[] = [];
  private defaultVolume: number;

  constructor(defaultVolume: number = DEFAULT_MUSIC_CONFIG.defaultQuality) {
    this.defaultVolume = defaultVolume;
  }

  // ============================================================================
  // 5.1 Estructura básica - Constructor y dependencias
  // ============================================================================

  /**
   * Inicia la reproducción de un track
   * 
   * @param voiceSession - Sesión de voz activa
   * @param song - Canción a reproducir
   * @param stream - Stream de audio (ReadableStream from AudioStreamService)
   * @param options - Opciones adicionales (volume, etc.)
   * @returns Promise<PlaybackResult>
   */
  async play(
    voiceSession: VoiceSession,
    song: Song,
    stream: ReadableStream<Uint8Array>,
    options?: StreamOptions
  ): Promise<PlaybackResult> {
    const { guildId, player } = voiceSession;

    logger.info("🎵 Iniciando reproducción", {
      guildId,
      songTitle: song.title,
      songUrl: song.url,
    });

    try {
      // Detectar el tipo de stream basado en la plataforma
      // YouTube (yt-dlp + ffmpeg) produce PCM s16le = Raw
      // Spotify (play-dl) produce Opus/otro = Arbitrary
      const isYouTube = song.url.includes("youtube") || song.url.includes("youtu.be");
      const streamType = isYouTube ? StreamType.Raw : StreamType.Arbitrary;

      // Crear el AudioResource
      // Nota: @discordjs/voice 0.19.0 acepta web ReadableStream en su типовая система
      // Usamos type assertion para compatibilidad con el tipo retornado por play-dl
      const audioResource = createAudioResource(stream as any, {
        inlineVolume: true,
        inputType: streamType,
        metadata: {
          song,
          guildId,
        },
      });

      // Aplicar volumen si se especifica
      const volume = options?.volume ?? this.defaultVolume;
      audioResource.volume?.setVolume(volume);

      // Obtener o crear estado del player para este guild
      let playerState = this.players.get(guildId);
      
      if (!playerState) {
        playerState = {
          guildId,
          player,
          currentSong: null,
          currentResource: null,
          volume,
          isPlaying: false,
          isPaused: false,
        };
        this.players.set(guildId, playerState);
      }

      // Detener cualquier reproducción actual
      if (playerState.currentResource) {
        player.stop();
      }

      // Configurar el player con el nuevo resource
      player.play(audioResource);

      // SUSCRIBIR EL PLAYER A LA CONEXIÓN - esto es crítico para que se reproduzca el audio
      const subscription = voiceSession.connection.subscribe(player);
      if (!subscription) {
        logger.warn("⚠️ No se pudo suscribir el player a la conexión", { guildId });
      }

      // Actualizar estado
      playerState.currentSong = song;
      playerState.currentResource = audioResource;
      playerState.volume = volume;
      playerState.isPlaying = true;
      playerState.isPaused = false;

      // Configurar event handlers para el player (si no están configurados)
      this.setupPlayerEventHandlers(guildId, player);

      logger.info("✅ Reproducción iniciada correctamente", {
        guildId,
        songTitle: song.title,
        volume,
      });

      return {
        success: true,
        song,
      };
    } catch (error) {
      logger.error("❌ Error al iniciar reproducción", {
        guildId,
        songTitle: song.title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      const playbackError = this.createPlaybackError(
        "STREAM_FAILED",
        error instanceof Error ? error.message : "Error desconocido al iniciar reproducción",
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: playbackError,
      };
    }
  }

  // ============================================================================
  // 5.2 Implementar pause() - pausar reproducción
  // ============================================================================

  /**
   * Pausa la reproducción actual
   * 
   * @param guildId - ID del servidor
   * @returns boolean - True si se pausó correctamente
   */
  pause(guildId: string): boolean {
    const playerState = this.players.get(guildId);

    if (!playerState) {
      logger.warn("No hay reproducción para pausar", { guildId });
      return false;
    }

    if (!playerState.isPlaying || playerState.isPaused) {
      logger.debug("El player no está en estado reproducible para pausar", {
        guildId,
        isPlaying: playerState.isPlaying,
        isPaused: playerState.isPaused,
      });
      return false;
    }

    const success = playerState.player.pause();

    if (success) {
      playerState.isPaused = true;
      playerState.isPlaying = false;

      logger.info("⏸️ Reproducción pausada", { guildId });
    } else {
      logger.warn("No se pudo pausar el reproductor", { guildId });
    }

    return success;
  }

  // ============================================================================
  // 5.3 Implementar resume() - reanudar reproducción
  // ============================================================================

  /**
   * Reanuda la reproducción pausada
   * 
   * @param guildId - ID del servidor
   * @returns boolean - True si se reanudó correctamente
   */
  resume(guildId: string): boolean {
    const playerState = this.players.get(guildId);

    if (!playerState) {
      logger.warn("No hay reproducción para reanudar", { guildId });
      return false;
    }

    if (!playerState.isPaused) {
      logger.debug("El player no está en estado pausado para reanudar", {
        guildId,
        isPlaying: playerState.isPlaying,
        isPaused: playerState.isPaused,
      });
      return false;
    }

    const success = playerState.player.unpause();

    if (success) {
      playerState.isPaused = false;
      playerState.isPlaying = true;

      logger.info("▶️ Reproducción reanudada", { guildId });
    } else {
      logger.warn("No se pudo reanudar el reproductor", { guildId });
    }

    return success;
  }

  // ============================================================================
  // 5.4 Implementar skip() - saltar a la siguiente canción
  // ============================================================================

  /**
   * Skip to next song - stops current playback
   * Note: This just stops the player. Queue advancement should be handled by caller.
   * 
   * @param guildId - ID del servidor
   * @returns boolean - True si se detuvo correctamente
   */
  skip(guildId: string): boolean {
    const playerState = this.players.get(guildId);

    if (!playerState) {
      logger.warn("No hay reproducción para hacer skip", { guildId });
      return false;
    }

    if (!playerState.currentSong) {
      logger.debug("No hay canción actual para hacer skip", { guildId });
      return false;
    }

    const currentSong = playerState.currentSong;
    
    // Detener el player
    playerState.player.stop();

    // Limpiar estado
    playerState.currentSong = null;
    playerState.currentResource = null;
    playerState.isPlaying = false;
    playerState.isPaused = false;

    logger.info("⏭️ Skip ejecutado", {
      guildId,
      skippedSong: currentSong.title,
    });

    // Emitir evento de playback ended (skipped)
    this.emitPlaybackEnded({
      guildId,
      song: currentSong,
      reason: "stopped",
      timestamp: new Date(),
    });

    return true;
  }

  // ============================================================================
  // 5.5 Implementar stop() - detener reproducción y cleanup
  // ============================================================================

  /**
   * Detiene la reproducción completamente y limpia los recursos
   * 
   * @param guildId - ID del servidor
   * @returns boolean - True si se detuvo correctamente
   */
  stop(guildId: string): boolean {
    const playerState = this.players.get(guildId);

    if (!playerState) {
      logger.debug("No hay reproducción para detener", { guildId });
      return false;
    }

    const currentSong = playerState.currentSong;

    // Detener el player
    playerState.player.stop();

    // Emitir evento de playback ended si había una canción
    if (currentSong) {
      this.emitPlaybackEnded({
        guildId,
        song: currentSong,
        reason: "stopped",
        timestamp: new Date(),
      });
    }

    // Limpiar estado
    playerState.currentSong = null;
    playerState.currentResource = null;
    playerState.isPlaying = false;
    playerState.isPaused = false;

    logger.info("⏹️ Reproducción detenida", { guildId });

    return true;
  }

  // ============================================================================
  // 5.6 Implementar setVolume() - ajustar volumen durante reproducción
  // ============================================================================

  /**
   * Ajusta el volumen de la reproducción actual
   * 
   * @param guildId - ID del servidor
   * @param volume - Volumen (0.0 a 1.0, donde 1.0 = 100%)
   * @returns boolean - True si se ajustó correctamente
   */
  setVolume(guildId: string, volume: number): boolean {
    const playerState = this.players.get(guildId);

    if (!playerState) {
      logger.warn("No hay reproducción para ajustar volumen", { guildId });
      return false;
    }

    // Validar volumen
    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (playerState.currentResource?.volume) {
      playerState.currentResource.volume.setVolume(clampedVolume);
      playerState.volume = clampedVolume;

      logger.debug("Volumen ajustado", {
        guildId,
        volume: clampedVolume,
      });

      return true;
    }

    logger.warn("No hay recurso de audio para ajustar volumen", { guildId });
    return false;
  }

  /**
   * Obtiene el volumen actual
   * 
   * @param guildId - ID del servidor
   * @returns number - Volumen actual (0.0 a 1.0)
   */
  getVolume(guildId: string): number {
    const playerState = this.players.get(guildId);
    return playerState?.volume ?? this.defaultVolume;
  }

  // ============================================================================
  // 5.7 Implementar event handlers - AudioPlayer lifecycle
  // ============================================================================

  /**
   * Configura los event handlers para el AudioPlayer
   * 
   * @param guildId - ID del servidor
   * @param player - AudioPlayer instance
   */
  private setupPlayerEventHandlers(guildId: string, player: AudioPlayer): void {
    // Solo configurar una vez por guild
    const playerState = this.players.get(guildId);
    if (playerState && (playerState.player as any).__handlersSetup) {
      return;
    }

    // Handler para cuando el player está en idle (canción terminada)
    player.on(AudioPlayerStatus.Idle, async (oldState) => {
      logger.debug("🔄 Player transitioned to Idle", {
        guildId,
        oldState: oldState.status,
      });

      const state = this.players.get(guildId);
      if (state && state.currentSong) {
        const finishedSong = state.currentSong;

        // Emitir evento de playback ended
        this.emitPlaybackEnded({
          guildId,
          song: finishedSong,
          reason: "finished",
          timestamp: new Date(),
        });

        // IMPORTANTE: Reproducir siguiente canción automáticamente
        try {
          // Importar servicios aquí para evitar dependencia circular
          const { QueueManagementService, AudioStreamService, VoiceConnectionService } = require("./index");
          
          // Obtener la sesión de voz
          const session = VoiceConnectionService.getSession(guildId);
          if (session) {
            // Obtener siguiente canción de la cola
            const nextSong = await QueueManagementService.dequeue(guildId);
            
            if (nextSong) {
              logger.info("🎵 Reproduciendo siguiente canción automáticamente", {
                guildId,
                title: nextSong.title,
              });

              // Crear stream y reproducir
              const streamSource = await AudioStreamService.resolve(nextSong.url, guildId);
              const stream = await AudioStreamService.createStream(streamSource);
              
              // Actualizar estado de la cola
              QueueManagementService.setPlaybackState(guildId, { isPlaying: true });
              
              // Actualizar currentSong para /nowplaying y otros comandos
              QueueManagementService.setCurrentSong(guildId, {
                title: nextSong.title,
                url: nextSong.url,
                duration: nextSong.duration,
                thumbnail: nextSong.thumbnail,
                requester: nextSong.requester,
              });
              
              // Reproducir
              await this.play(session, nextSong, stream);
            } else {
              // No hay más canciones - actualizar estado
              QueueManagementService.setPlaybackState(guildId, { isPlaying: false });
              QueueManagementService.setCurrentSong(guildId, null);
              logger.info("🎵 Cola vacía, reproducción finalizada", { guildId });
            }
          }
        } catch (autoPlayError) {
          logger.error("Error en reproducción automática", {
            guildId,
            error: autoPlayError instanceof Error ? autoPlayError.message : String(autoPlayError),
          });
        }

        // Limpiar estado
        state.currentSong = null;
        state.currentResource = null;
        state.isPlaying = false;
        state.isPaused = false;
      }
    });

    // Handler para cuando el player está reproduciendo
    player.on(AudioPlayerStatus.Playing, (oldState) => {
      logger.debug("▶️ Player transitioned to Playing", {
        guildId,
        oldState: oldState.status,
      });

      const state = this.players.get(guildId);
      if (state) {
        state.isPlaying = true;
        state.isPaused = false;

        // Emitir evento de playback started
        if (state.currentSong) {
          this.emitPlaybackStarted({
            guildId,
            song: state.currentSong,
            timestamp: new Date(),
          });
        }
      }
    });

    // Handler para cuando el player está en buffer (cargando)
    player.on(AudioPlayerStatus.Buffering, (oldState) => {
      logger.debug("📥 Player transitioned to Buffering", {
        guildId,
        oldState: oldState.status,
      });
    });

    // Handler para cuando el player está pausado
    player.on(AudioPlayerStatus.Paused, (oldState) => {
      logger.debug("⏸️ Player transitioned to Paused", {
        guildId,
        oldState: oldState.status,
      });

      const state = this.players.get(guildId);
      if (state) {
        state.isPaused = true;
        state.isPlaying = false;
      }
    });

    // Handler para auto-pause (cuando Discord hace pause automático)
    player.on(AudioPlayerStatus.AutoPaused, (oldState) => {
      logger.debug("⏸️ Player transitioned to AutoPaused", {
        guildId,
        oldState: oldState.status,
      });

      const state = this.players.get(guildId);
      if (state) {
        state.isPaused = true;
        state.isPlaying = false;
      }
    });

    // Handler para errores
    player.on("error", (error) => {
      logger.error("❌ Error en AudioPlayer", {
        guildId,
        error: error.message,
        stack: error.stack,
      });

      const state = this.players.get(guildId);
      const currentSong = state?.currentSong;

      // Emitir evento de playback error
      this.emitPlaybackError({
        guildId,
        error: this.createPlaybackError(
          "PLAYER_ERROR",
          error.message,
          error
        ),
        timestamp: new Date(),
      });

      // Limpiar estado
      if (state) {
        state.currentSong = null;
        state.currentResource = null;
        state.isPlaying = false;
        state.isPaused = false;
      }
    });

    // Marcar como configurado
    if (playerState) {
      (playerState.player as any).__handlersSetup = true;
    }

    logger.debug("Event handlers configurados para AudioPlayer", { guildId });
  }

  // ============================================================================
  // Métodos de utilidad
  // ============================================================================

  /**
   * Obtiene el estado actual del player para un guild
   * 
   * @param guildId - ID del servidor
   * @returns PlayerState | null
   */
  getState(guildId: string): PlayerState | null {
    return this.players.get(guildId) || null;
  }

  /**
   * Verifica si hay reproducción activa para un guild
   * 
   * @param guildId - ID del servidor
   * @returns boolean
   */
  isPlaying(guildId: string): boolean {
    const state = this.players.get(guildId);
    return state?.isPlaying ?? false;
  }

  /**
   * Verifica si la reproducción está pausada para un guild
   * 
   * @param guildId - ID del servidor
   * @returns boolean
   */
  isPaused(guildId: string): boolean {
    const state = this.players.get(guildId);
    return state?.isPaused ?? false;
  }

  /**
   * Obtiene la canción actual para un guild
   * 
   * @param guildId - ID del servidor
   * @returns Song | null
   */
  getCurrentSong(guildId: string): Song | null {
    const state = this.players.get(guildId);
    return state?.currentSong ?? null;
  }

  /**
   * Limpia el estado del player para un guild
   * 
   * @param guildId - ID del servidor
   */
  cleanup(guildId: string): void {
    const state = this.players.get(guildId);
    
    if (state) {
      // Remover todos los listeners para evitar memory leaks
      state.player.removeAllListeners();
      
      // Detener el player
      state.player.stop();
      
      // Eliminar del mapa
      this.players.delete(guildId);

      logger.debug("Player state limpiado", { guildId });
    }
  }

  /**
   * Limpia todos los players (para shutdown)
   */
  destroyAll(): void {
    logger.info("🧹 Limpiando todos los players");

    for (const [guildId] of this.players) {
      this.cleanup(guildId);
    }

    logger.info("✅ Todos los players limpiados");
  }

  // ============================================================================
  // Event Emitter
  // ============================================================================

  /**
   * Registra un handler para eventos de playback
   * 
   * @param handler - Handler con callbacks opcionales
   */
  on(handler: EventHandlers): void {
    this.eventHandlers.push(handler);
    logger.debug("Event handler registrado para PlayerService");
  }

  /**
   * Remueve un handler de eventos de playback
   * 
   * @param handler - Handler a remover
   */
  off(handler: EventHandlers): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
      logger.debug("Event handler removido de PlayerService");
    }
  }

  /**
   * Emite evento de playback started
   */
  private emitPlaybackStarted(event: PlaybackStartedEvent): void {
    for (const handler of this.eventHandlers) {
      handler.onPlaybackStarted?.(event);
    }
  }

  /**
   * Emite evento de playback ended
   */
  private emitPlaybackEnded(event: PlaybackEndedEvent): void {
    for (const handler of this.eventHandlers) {
      handler.onPlaybackEnded?.(event);
    }
  }

  /**
   * Emite evento de playback error
   */
  private emitPlaybackError(event: PlaybackErrorEvent): void {
    for (const handler of this.eventHandlers) {
      handler.onPlaybackError?.(event);
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Crea un PlaybackError estructurado
   */
  private createPlaybackError(
    code: PlaybackErrorCode,
    message: string,
    originalError?: Error
  ): PlaybackError {
    return {
      code,
      message,
      originalError,
    };
  }
}

// ============================================================================
// Instancia singleton
// ============================================================================

let playerServiceInstance: PlayerServiceImpl | null = null;

/**
 * Obtiene la instancia singleton de PlayerService
 * 
 * @example
 * import { PlayerService } from './services/music';
 * await PlayerService.play(session, song, stream);
 * PlayerService.pause(guildId);
 */
function getPlayerService(): PlayerServiceImpl {
  if (!playerServiceInstance) {
    playerServiceInstance = new PlayerServiceImpl();
  }
  return playerServiceInstance;
}

// ============================================================================
// Export como objeto con todos los métodos
// ============================================================================

export const PlayerService = {
  play: (...args: Parameters<PlayerServiceImpl['play']>) => 
    getPlayerService().play(...args),
  pause: (...args: Parameters<PlayerServiceImpl['pause']>) => 
    getPlayerService().pause(...args),
  resume: (...args: Parameters<PlayerServiceImpl['resume']>) => 
    getPlayerService().resume(...args),
  skip: (...args: Parameters<PlayerServiceImpl['skip']>) => 
    getPlayerService().skip(...args),
  stop: (...args: Parameters<PlayerServiceImpl['stop']>) => 
    getPlayerService().stop(...args),
  setVolume: (...args: Parameters<PlayerServiceImpl['setVolume']>) => 
    getPlayerService().setVolume(...args),
  getVolume: (...args: Parameters<PlayerServiceImpl['getVolume']>) => 
    getPlayerService().getVolume(...args),
  getState: (...args: Parameters<PlayerServiceImpl['getState']>) => 
    getPlayerService().getState(...args),
  isPlaying: (...args: Parameters<PlayerServiceImpl['isPlaying']>) => 
    getPlayerService().isPlaying(...args),
  isPaused: (...args: Parameters<PlayerServiceImpl['isPaused']>) => 
    getPlayerService().isPaused(...args),
  getCurrentSong: (...args: Parameters<PlayerServiceImpl['getCurrentSong']>) => 
    getPlayerService().getCurrentSong(...args),
  cleanup: (...args: Parameters<PlayerServiceImpl['cleanup']>) => 
    getPlayerService().cleanup(...args),
  destroyAll: () => getPlayerService().destroyAll(),
  on: (handler: EventHandlers) => getPlayerService().on(handler),
  off: (handler: EventHandlers) => getPlayerService().off(handler),
};

// ============================================================================
// Factory para testing e inyección de dependencias
// ============================================================================

/**
 * Crea una nueva instancia de PlayerService
 * Útil para testing o cuando se necesita una instancia independiente
 * 
 * @param defaultVolume - Volumen por defecto
 * @returns Nueva instancia de PlayerService
 * 
 * @example
 * const service = createPlayerService(0.5);
 * await service.play(session, song, stream);
 */
export function createPlayerService(defaultVolume?: number): PlayerServiceImpl {
  return new PlayerServiceImpl(defaultVolume);
}

// ============================================================================
// Tipos para event handlers
// ============================================================================

export type { EventHandlers };