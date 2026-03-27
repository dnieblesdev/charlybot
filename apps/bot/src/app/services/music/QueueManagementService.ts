/**
 * QueueManagementService - Gestión de colas de reproducción
 * 
 * Responsabilidades:
 * - Enqueue/dequeue de canciones
 * - Modos de loop y shuffle
 * - Serialización para persistencia
 * - Buffer dinámico para playlists grandes
 * 
 * Este servicio maneja el estado de la cola por guild y coordina con:
 * - IMusicRepository para persistencia write-through
 * - Buffer callbacks para refill automático de playlists
 */

import type { IMusicRepository } from "../../../domain/ports/IMusicRepository";
import type {
  Song,
  Track,
  LoopMode,
  QueueSnapshot,
  BufferCallback,
} from "./types";
import type { IMusicQueueItem } from "@charlybot/shared";
import logger from "../../../utils/logger";
import type { MusicConfig } from "../../../config/music";

// ============================================================================
// Tipos internos del servicio
// ============================================================================

interface InternalQueue {
  guildId: string;
  songs: Song[];
  currentSong: Song | null;
  loopMode: LoopMode;
  volume: number;
  isPlaying: boolean;
  isPaused: boolean;
}

interface PlaylistBufferState {
  allTracks: Array<{ name: string; artists?: Array<{ name: string }> }>;
  requester: { id: string; username: string };
  config: MusicConfig;
  bufferSize: number;
  currentIndex: number;
  isProcessing: boolean;
}

// ============================================================================
// Clase del servicio
// ============================================================================

class QueueManagementServiceClass {
  private queues = new Map<string, InternalQueue>();
  private repository: IMusicRepository;
  private bufferCallbacks = new Map<string, BufferCallback>();
  private playlistBuffers = new Map<string, PlaylistBufferState>();
  private settingsSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(repository: IMusicRepository) {
    this.repository = repository;
    logger.info("QueueManagementService initialized", {
      persistence: "write-through",
    });
  }

  // ============================================================================
  // Métodos principales
  // ============================================================================

  /**
   * Agrega una canción a la cola
   */
  async enqueue(
    guildId: string,
    track: Omit<Track, "id" | "addedAt">
  ): Promise<QueueSnapshot> {
    // Obtener o crear cola
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }

    // Convertir Track a Song
    const song: Song = {
      title: track.source.title,
      url: track.source.url,
      duration: track.source.duration,
      thumbnail: track.source.thumbnail,
      requester: {
        id: track.requestedBy,
        username: track.requestedBy, // TODO: resolver username
      },
    };

    // Agregar a la cola
    queue.songs.push(song);

    // Persistencia write-through
    await this.persistAddItem(guildId, song);

    logger.debug("Song enqueued", {
      guildId,
      title: song.title,
      queueLength: queue.songs.length,
    });

    return this.internalGetSnapshot(queue);
  }

  /**
   * Agrega múltiples canciones a la cola (batch)
   */
  async enqueueBatch(
    guildId: string,
    tracks: Array<Omit<Track, "id" | "addedAt">>
  ): Promise<QueueSnapshot> {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }

    const songs: Song[] = tracks.map((track) => ({
      title: track.source.title,
      url: track.source.url,
      duration: track.source.duration,
      thumbnail: track.source.thumbnail,
      requester: {
        id: track.requestedBy,
        username: track.requestedBy,
      },
    }));

    queue.songs.push(...songs);

    // Persistencia write-through para cada item
    for (const song of songs) {
      await this.persistAddItem(guildId, song);
    }

    logger.debug("Songs batch enqueued", {
      guildId,
      count: songs.length,
      queueLength: queue.songs.length,
    });

    return this.internalGetSnapshot(queue);
  }

  /**
   * Obtiene y remueve la siguiente canción de la cola
   */
  async dequeue(guildId: string): Promise<Song | null> {
    const queue = this.queues.get(guildId);
    if (!queue || queue.songs.length === 0) {
      // Verificar si hay algo en loop song
      if (queue?.loopMode === "song" && queue.currentSong) {
        // En loop song, devolvemos la canción actual
        return queue.currentSong;
      }
      return null;
    }

    let song: Song | undefined;

    switch (queue.loopMode) {
      case "song":
        // Loop de canción: devolver la actual
        song = queue.currentSong || queue.songs[0];
        break;

      case "queue":
        // Loop de cola: mover la primera canción al final
        song = queue.songs.shift()!;
        queue.songs.push(song);
        break;

      case "none":
      default:
        // Normal: obtener primera y remover
        song = queue.songs.shift()!;
        break;
    }

    if (!song) return null;

    // Actualizar currentSong
    queue.currentSong = song;

    // Persistencia: remover el primer item
    await this.persistRemoveItem(guildId, 0);

    // Verificar buffer dinámico
    await this.checkAndRefillBuffer(guildId);

    logger.debug("Song dequeued", {
      guildId,
      title: song.title,
      remaining: queue.songs.length,
    });

    return song;
  }

  /**
   * Obtiene la siguiente canción sin removerla
   */
  async peek(guildId: string): Promise<Song | null> {
    const queue = this.queues.get(guildId);
    if (!queue || queue.songs.length === 0) {
      if (queue?.loopMode === "song" && queue.currentSong) {
        return queue.currentSong;
      }
      return null;
    }

    return queue.songs[0] ?? null;
  }

  /**
   * Obtiene la canción actual
   */
  async getCurrent(guildId: string): Promise<Song | null> {
    const queue = this.queues.get(guildId);
    return queue?.currentSong ?? null;
  }

  /**
   * Configura el modo de loop
   */
  setLoopMode(guildId: string, mode: LoopMode): QueueSnapshot {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }

    queue.loopMode = mode;
    this.debouncedUpdateSettings(guildId, { loopMode: mode });

    logger.info("Loop mode set", { guildId, mode });
    return this.internalGetSnapshot(queue);
  }

  /**
   * Configura el volumen
   */
  setVolume(guildId: string, volume: number): QueueSnapshot {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }

    // Clampear volumen entre 0 y 100
    queue.volume = Math.max(0, Math.min(100, volume));
    this.debouncedUpdateSettings(guildId, { volume: queue.volume });

    logger.debug("Volume set", { guildId, volume: queue.volume });
    return this.internalGetSnapshot(queue);
  }

  /**
   * Revuelve la cola (shuffle)
   */
  shuffle(guildId: string): QueueSnapshot {
    const queue = this.queues.get(guildId);
    if (!queue || queue.songs.length <= 1) {
      return queue ? this.internalGetSnapshot(queue) : this.internalGetSnapshot(this.createQueue(guildId));
    }

    // Fisher-Yates shuffle
    for (let i = queue.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = queue.songs[i];
      const swap = queue.songs[j];
      if (temp && swap) {
        queue.songs[i] = swap;
        queue.songs[j] = temp;
      }
    }

    // Re-persistir cola actualizada
    this.persistQueueItems(guildId).catch((err) => {
      logger.warn("Failed to persist shuffled queue", { guildId, error: err });
    });

    logger.info("Queue shuffled", { guildId, songCount: queue.songs.length });
    return this.internalGetSnapshot(queue);
  }

  /**
   * Limpia la cola
   */
  async clear(guildId: string): Promise<QueueSnapshot> {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }

    queue.songs = [];
    queue.currentSong = null;

    // Persistencia
    await this.persistClearQueue(guildId);

    logger.info("Queue cleared", { guildId });
    return this.internalGetSnapshot(queue);
  }

  /**
   * Remueve una canción en posición específica
   */
  async remove(guildId: string, position: number): Promise<Song | null> {
    const queue = this.queues.get(guildId);
    if (!queue || position < 0 || position >= queue.songs.length) {
      return null;
    }

    const [song] = queue.songs.splice(position, 1);
    if (!song) return null;

    // Persistencia
    await this.persistRemoveItem(guildId, position);

    logger.debug("Song removed", { guildId, position, title: song.title });
    return song;
  }

  // ============================================================================
  // Serialización / Persistencia
  // ============================================================================

  /**
   * Serializa el estado de la cola para persistencia
   */
  async serialize(guildId: string): Promise<QueueSnapshot | null> {
    const queue = this.queues.get(guildId);
    if (!queue) {
      // Intentar recuperar desde repository
      const persisted = await this.repository.getQueue(guildId);
      if (!persisted) return null;

      // Reconstruir desde persistencia
      const restoredQueue = this.createQueue(guildId);
      restoredQueue.volume = persisted.volume;
      restoredQueue.loopMode = persisted.loopMode as LoopMode;
      restoredQueue.isPlaying = persisted.isPlaying;
      restoredQueue.isPaused = persisted.isPaused;

      if (persisted.items?.length) {
        restoredQueue.songs = persisted.items.map((item) => ({
          title: item.title,
          url: item.url,
          duration: item.duration,
          thumbnail: item.thumbnail || undefined,
          requester: {
            id: item.requesterId,
            username: item.requesterName,
          },
        }));

        // Restaurar currentSong
        if (persisted.currentSongId) {
          const idx = restoredQueue.songs.findIndex(
            (s) => s.url === persisted.currentSongId
          );
          if (idx > 0) {
            const [current] = restoredQueue.songs.splice(idx, 1);
            restoredQueue.songs.unshift(current!);
          }
        }
      }

      this.queues.set(guildId, restoredQueue);
      return this.internalGetSnapshot(restoredQueue);
    }

    return this.internalGetSnapshot(queue);
  }

  /**
   * Deserializa y restaura el estado desde persistencia
   */
  async deserialize(guildId: string): Promise<QueueSnapshot> {
    const snapshot = await this.serialize(guildId);
    if (!snapshot) {
      return this.internalGetSnapshot(this.createQueue(guildId));
    }
    return snapshot;
  }

  /**
   * Obtiene el snapshot actual de la cola
   */
  getSnapshotByGuildId(guildId: string): QueueSnapshot {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return this.internalGetSnapshot(this.createQueue(guildId));
    }
    return this.internalGetSnapshot(queue);
  }

  // ============================================================================
  // Buffer dinámico para playlists
  // ============================================================================

  /**
   * Registra un callback para cuando la cola está baja
   */
  onBufferShortage(guildId: string, callback: BufferCallback): void {
    this.bufferCallbacks.set(guildId, callback);
    logger.debug("Buffer shortage callback registered", { guildId });
  }

  /**
   * Remueve el callback de buffer
   */
  offBufferShortage(guildId: string): void {
    this.bufferCallbacks.delete(guildId);
    logger.debug("Buffer shortage callback removed", { guildId });
  }

  /**
   * Configura buffer dinámico para una playlist grande
   */
  setupDynamicBuffer(
    allTracks: Array<{ name: string; artists?: Array<{ name: string }> }>,
    requester: { id: string; username: string },
    config: MusicConfig,
    bufferSize: number,
  ): void {
    const bufferKey = `${requester.id}_${Date.now()}_playlist_buffer`;

    const bufferState: PlaylistBufferState = {
      allTracks,
      requester,
      config,
      bufferSize,
      currentIndex: bufferSize,
      isProcessing: false,
    };

    this.playlistBuffers.set(bufferKey, bufferState);

    logger.info("Dynamic buffer configured", {
      totalTracks: allTracks.length,
      bufferSize,
      remainingTracks: allTracks.length - bufferSize,
    });
  }

  /**
   * Obtiene el estado del buffer para un guild
   */
  getBufferState(guildId: string): PlaylistBufferState | null {
    const queue = this.queues.get(guildId);
    if (!queue) return null;

    // Buscar buffer activo asociado con este guild
    for (const [, bufferState] of this.playlistBuffers) {
      if (
        queue.songs.some(
          (song) => song.requester.id === bufferState.requester.id
        )
      ) {
        return bufferState;
      }
    }

    return null;
  }

  // ============================================================================
  // Utilidades internas
  // ============================================================================

  /**
   * Crea una nueva cola vacía
   */
  private createQueue(guildId: string): InternalQueue {
    return {
      guildId,
      songs: [],
      currentSong: null,
      loopMode: "none",
      volume: 100,
      isPlaying: false,
      isPaused: false,
    };
  }

  /**
   * Convierte InternalQueue a QueueSnapshot
   */
  private internalGetSnapshot(queue: InternalQueue): QueueSnapshot {
    return {
      guildId: queue.guildId,
      songs: [...queue.songs],
      currentSong: queue.currentSong,
      loopMode: queue.loopMode,
      volume: queue.volume,
      isPlaying: queue.isPlaying,
      isPaused: queue.isPaused,
    };
  }

  /**
   * Persiste un item agregado (write-through)
   */
  private async persistAddItem(guildId: string, song: Song): Promise<void> {
    try {
      await this.repository.addToQueue(guildId, {
        title: song.title,
        url: song.url,
        duration: song.duration,
        thumbnail: song.thumbnail,
        requesterId: song.requester.id,
        requesterName: song.requester.username,
      });
    } catch (error) {
      logger.warn("Failed to persist add item", {
        guildId,
        title: song.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Persisteremover item (write-through)
   */
  private async persistRemoveItem(
    guildId: string,
    position: number
  ): Promise<void> {
    try {
      await this.repository.removeFromQueue(guildId, position);
    } catch (error) {
      logger.warn("Failed to persist remove item", {
        guildId,
        position,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Persiste cola completa (para shuffle)
   */
  private async persistQueueItems(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    try {
      await this.repository.clearQueue(guildId);
      for (const song of queue.songs) {
        await this.repository.addToQueue(guildId, {
          title: song.title,
          url: song.url,
          duration: song.duration,
          thumbnail: song.thumbnail,
          requesterId: song.requester.id,
          requesterName: song.requester.username,
        });
      }
    } catch (error) {
      logger.warn("Failed to persist queue items", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Persiste clear de cola
   */
  private async persistClearQueue(guildId: string): Promise<void> {
    try {
      await this.repository.clearQueue(guildId);
    } catch (error) {
      logger.warn("Failed to persist clear queue", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Actualiza settings con debounce
   */
  private debouncedUpdateSettings(
    guildId: string,
    settings: Partial<{
      volume: number;
      loopMode: LoopMode;
      isPlaying: boolean;
      isPaused: boolean;
    }>
  ): void {
    const existingTimer = this.settingsSyncTimers.get(guildId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.settingsSyncTimers.delete(guildId);
      await this.persistUpdateSettings(guildId, settings);
    }, 1000);

    this.settingsSyncTimers.set(guildId, timer);
  }

  /**
   * Persiste settings inmediatamente
   */
  private async persistUpdateSettings(
    guildId: string,
    settings: Partial<{
      volume: number;
      loopMode: LoopMode;
      isPlaying: boolean;
      isPaused: boolean;
    }>
  ): Promise<void> {
    try {
      await this.repository.updateSettings(guildId, settings);
    } catch (error) {
      logger.warn("Failed to persist settings update", {
        guildId,
        settings,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Verifica y rellena el buffer dinámico
   */
  private async checkAndRefillBuffer(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    // Buscar buffer activo
    let bufferKey: string | null = null;
    let bufferState: PlaylistBufferState | null = null;

    for (const [key, state] of this.playlistBuffers) {
      if (
        queue.songs.some(
          (song) => song.requester.id === state.requester.id
        )
      ) {
        bufferKey = key;
        bufferState = state;
        break;
      }
    }

    if (!bufferKey || !bufferState || bufferState.isProcessing) return;

    const songsAhead = queue.songs.length;
    const refillThreshold = Math.floor(bufferState.bufferSize / 2);

    if (
      songsAhead < refillThreshold &&
      bufferState.currentIndex < bufferState.allTracks.length
    ) {
      logger.info("Buffer low, refilling", {
        guildId,
        currentBuffer: songsAhead,
        nextTrackIndex: bufferState.currentIndex,
      });

      bufferState.isProcessing = true;

      try {
        const nextTrack = bufferState.allTracks[bufferState.currentIndex];
        if (nextTrack) {
          // Emitir callback de buffer shortage
          const callback = this.bufferCallbacks.get(guildId);
          if (callback) {
            await callback(guildId);
          }

          bufferState.currentIndex++;
        }

        // Limpiar si terminamos
        if (bufferState.currentIndex >= bufferState.allTracks.length) {
          this.playlistBuffers.delete(bufferKey);
          logger.info("Playlist fully processed, buffer cleaned", {
            guildId,
            totalProcessed: bufferState.currentIndex,
          });
        }
      } catch (error) {
        logger.error("Error refilling buffer", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        bufferState.isProcessing = false;
      }
    }
  }

  // ============================================================================
  // Estado y utilidades
  // ============================================================================

  /**
   * Obtiene todas las colas
   */
  getAllQueues(): Map<string, InternalQueue> {
    return new Map(this.queues);
  }

  /**
   * Obtiene una cola específica
   */
  getQueue(guildId: string): InternalQueue | undefined {
    return this.queues.get(guildId);
  }

  /**
   * Verifica si existe cola para un guild
   */
  hasQueue(guildId: string): boolean {
    return this.queues.has(guildId);
  }

  /**
   * Obtiene la longitud de la cola
   */
  getQueueLength(guildId: string): number {
    const queue = this.queues.get(guildId);
    return queue?.songs.length || 0;
  }

  /**
   * Actualiza el estado de reproducción
   */
  setPlaybackState(
    guildId: string,
    state: { isPlaying?: boolean; isPaused?: boolean }
  ): void {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }

    if (state.isPlaying !== undefined) {
      queue.isPlaying = state.isPlaying;
    }
    if (state.isPaused !== undefined) {
      queue.isPaused = state.isPaused;
    }

    // Persistir inmediatamente para estados críticos
    this.persistUpdateSettings(guildId, {
      isPlaying: queue.isPlaying,
      isPaused: queue.isPaused,
    });
  }

  /**
   * Actualiza la canción actual
   */
  setCurrentSong(guildId: string, song: Song | null): void {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = this.createQueue(guildId);
      this.queues.set(guildId, queue);
    }
    queue.currentSong = song;
  }

  /**
   * Limpia el buffer de un requester específico
   */
  clearBuffer(requesterId: string): void {
    for (const [key, state] of this.playlistBuffers) {
      if (state.requester.id === requesterId) {
        this.playlistBuffers.delete(key);
        logger.debug("Buffer cleared", { requesterId });
        break;
      }
    }
  }
}

// ============================================================================
// Export factory
// ============================================================================

let queueServiceInstance: QueueManagementServiceClass | null = null;

/**
 * Crea una instancia de QueueManagementService
 */
export function createQueueManagementService(
  repository: IMusicRepository
): QueueManagementServiceClass {
  return new QueueManagementServiceClass(repository);
}

/**
 * Obtiene la instancia singleton (usa el adapter HTTP por defecto)
 */
export function getQueueManagementService(): QueueManagementServiceClass {
  if (!queueServiceInstance) {
    // Import dinámico para evitar dependencia circular
    const { HttpMusicAdapter } = require("../../../infrastructure/api/HttpMusicAdapter");
    queueServiceInstance = new QueueManagementServiceClass(
      new HttpMusicAdapter()
    );
  }
  return queueServiceInstance;
}

// Export por defecto para compatibilidad
export const QueueManagementService = {
  enqueue: async (
    guildId: string,
    track: Omit<Track, "id" | "addedAt">
  ): Promise<QueueSnapshot> => {
    const service = getQueueManagementService();
    return service.enqueue(guildId, track);
  },

  dequeue: async (guildId: string): Promise<Song | null> => {
    const service = getQueueManagementService();
    return service.dequeue(guildId);
  },

  peek: async (guildId: string): Promise<Song | null> => {
    const service = getQueueManagementService();
    return service.peek(guildId);
  },

  getCurrent: async (guildId: string): Promise<Song | null> => {
    const service = getQueueManagementService();
    return service.getCurrent(guildId);
  },

  setLoopMode: (guildId: string, mode: LoopMode): QueueSnapshot => {
    const service = getQueueManagementService();
    return service.setLoopMode(guildId, mode);
  },

  setVolume: (guildId: string, volume: number): QueueSnapshot => {
    const service = getQueueManagementService();
    return service.setVolume(guildId, volume);
  },

  shuffle: (guildId: string): QueueSnapshot => {
    const service = getQueueManagementService();
    return service.shuffle(guildId);
  },

  clear: async (guildId: string): Promise<QueueSnapshot> => {
    const service = getQueueManagementService();
    return service.clear(guildId);
  },

  remove: async (guildId: string, position: number): Promise<Song | null> => {
    const service = getQueueManagementService();
    return service.remove(guildId, position);
  },

  serialize: async (guildId: string): Promise<QueueSnapshot | null> => {
    const service = getQueueManagementService();
    return service.serialize(guildId);
  },

  deserialize: async (guildId: string): Promise<QueueSnapshot> => {
    const service = getQueueManagementService();
    return service.deserialize(guildId);
  },

  getSnapshot: (guildId: string): QueueSnapshot => {
    const service = getQueueManagementService();
    return service.getSnapshotByGuildId(guildId);
  },

  onBufferShortage: (guildId: string, callback: BufferCallback): void => {
    const service = getQueueManagementService();
    service.onBufferShortage(guildId, callback);
  },

  offBufferShortage: (guildId: string): void => {
    const service = getQueueManagementService();
    service.offBufferShortage(guildId);
  },

  getQueueLength: (guildId: string): number => {
    const service = getQueueManagementService();
    return service.getQueueLength(guildId);
  },

  hasQueue: (guildId: string): boolean => {
    const service = getQueueManagementService();
    return service.hasQueue(guildId);
  },

  setPlaybackState: (
    guildId: string,
    state: { isPlaying?: boolean; isPaused?: boolean }
  ): void => {
    const service = getQueueManagementService();
    service.setPlaybackState(guildId, state);
  },

  setCurrentSong: (guildId: string, song: Song | null): void => {
    const service = getQueueManagementService();
    service.setCurrentSong(guildId, song);
  },
};

// Export types
export type { InternalQueue, PlaylistBufferState };
