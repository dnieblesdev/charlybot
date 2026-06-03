/**
 * MusicService - Fachada de delegación a servicios especializados
 *
 * Esta clase actúa como una fachada delgada que delega todas las operaciones
 * a los 4 servicios especializados:
 * - VoiceConnectionService: gestión de conexiones de voz
 * - AudioStreamService: resolución y stream de audio
 * - QueueManagementService: gestión de colas
 * - PlayerService: control de reproducción
 *
 * Mantiene backward compatibility con todos los comandos existentes.
 */

import type { VoiceChannel, StageChannel, TextChannel } from "discord.js";
import type { VoiceConnection } from "@discordjs/voice";
import type { Song, LoopMode, MusicQueue } from "../../types/music.ts";

// Importar los servicios especializados
import {
  VoiceConnectionService,
  AudioStreamService,
  QueueManagementService,
  PlayerService,
  type StreamSource,
  type StreamOptions,
  type Song as ServiceSong,
  type Track,
} from "./music/index";

import logger from "../../utils/logger.ts";
import { getMusicQueueEventBridge } from "../../infrastructure/streams";

class MusicService {
  /**
   * Une el bot a un canal de voz
   * Delega a VoiceConnectionService
   */
  async join(
    guildId: string,
    voiceChannel: VoiceChannel | StageChannel,
    textChannel: TextChannel
  ): Promise<VoiceConnection> {
    try {
      // Usar VoiceConnectionService para establecer conexión
      const session = await VoiceConnectionService.join(
        guildId,
        voiceChannel,
        textChannel
      );

      logger.info(
        {
          guildId,
          channelId: voiceChannel.id,
        },
        "Bot joined voice channel via facade"
      );

      return session.connection;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error joining voice channel via facade"
      );
      throw error;
    }
  }

  /**
   * Desconecta el bot del canal de voz
   * Delega a VoiceConnectionService
   */
  async leave(guildId: string): Promise<void> {
    try {
      await VoiceConnectionService.leave(guildId);
      logger.info({ guildId }, "Bot left voice channel via facade");
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error leaving voice channel via facade"
      );
      throw error;
    }
  }

  /**
   * Agrega canciones a la cola y reproduce si no está reproduciendo
   * Delega a QueueManagementService -> AudioStreamService -> PlayerService
   */
  async play(
    guildId: string,
    query: string,
    requester: { id: string; username: string }
  ): Promise<{ added: Song[]; playing: boolean }> {
    try {
      // Verificar que hay sesión de voz activa
      const session = VoiceConnectionService.getSession(guildId);
      if (!session) {
        throw new Error("No hay una cola activa. Usa /join primero.");
      }

      // Verificar si ya está reproduciendo usando PlayerService (más preciso que el snapshot)
      const isCurrentlyPlaying = PlayerService.isPlaying(guildId);

      // Resolver la query a una fuente de stream
      const source = await AudioStreamService.resolve(query, guildId);

      // Convertir StreamSource a Track para la cola
      const track: Omit<Track, "id" | "addedAt"> = {
        source: {
          url: source.url,
          title: source.title,
          duration: source.duration,
          thumbnail: source.thumbnail,
          platform: source.platform,
        },
        requestedBy: requester.id,
      };

      // Agregar a la cola
      const updatedSnapshot = await QueueManagementService.enqueue(
        guildId,
        track
      );

      // Publish enqueue event to stream
      const bridge = getMusicQueueEventBridge();
      bridge
        .publishEnqueue(
          guildId,
          {
            title: source.title,
            url: source.url,
            duration: source.duration,
            thumbnail: source.thumbnail,
            requesterId: requester.id,
            requesterName: requester.username,
          },
          updatedSnapshot.songs.length
        )
        .catch((err) => {
          logger.warn({ error: err.message }, "Stream enqueue event failed");
        });

      let playing = false;
      // Solo iniciar reproducción si NO está actualmente reproduciendo
      if (!isCurrentlyPlaying && updatedSnapshot.songs.length > 0) {
        const nextSong = await QueueManagementService.dequeue(guildId);
        if (nextSong) {
          // Buscar el source para el stream
          const streamSource = await AudioStreamService.resolve(
            nextSong.url,
            guildId
          );
          const stream = await AudioStreamService.createStream(streamSource, {
            volume: (updatedSnapshot.volume ?? 100) / 100,
          });

          // IMPORTANTE: Actualizar estado en la cola para que los comandos funcionen
          QueueManagementService.setPlaybackState(guildId, { isPlaying: true });

          // Actualizar currentSong para /nowplaying y otros comandos
          QueueManagementService.setCurrentSong(guildId, {
            title: nextSong.title,
            url: nextSong.url,
            duration: nextSong.duration,
            thumbnail: nextSong.thumbnail,
            requester: nextSong.requester,
          });

          // Publish nowplaying event to stream
          bridge
            .publishNowPlaying(
              guildId,
              {
                title: nextSong.title,
                url: nextSong.url,
                duration: nextSong.duration,
                thumbnail: nextSong.thumbnail,
                requesterId: nextSong.requester.id,
                requesterName: nextSong.requester.username,
              },
              updatedSnapshot.songs.length - 1
            )
            .catch((err) => {
              logger.warn(
                { error: err.message },
                "Stream nowplaying event failed"
              );
            });

          await PlayerService.play(session, nextSong, stream);
          playing = true;
        }
      } else {
        // Ya estaba reproduciendo - solo agregar a la cola
        logger.info(
          {
            guildId,
            title: source.title,
            queueLength: updatedSnapshot.songs.length,
          },
          "Song added to queue (already playing)"
        );
      }

      logger.info(
        {
          guildId,
          query,
          title: source.title,
          isCurrentlyPlaying,
          nowPlaying: playing,
        },
        "Song added via facade"
      );

      const addedSong: Song = {
        title: source.title,
        url: source.url,
        duration: source.duration,
        thumbnail: source.thumbnail,
        requester,
      };

      return { added: [addedSong], playing };
    } catch (error) {
      logger.error(
        {
          guildId,
          query,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error in play via facade"
      );
      throw error;
    }
  }

  /**
   * Detiene la reproducción y limpia la cola
   * Delega a PlayerService
   */
  stop(guildId: string): boolean {
    try {
      PlayerService.stop(guildId);
      logger.info({ guildId }, "Playback stopped via facade");
      return true;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error stopping via facade"
      );
      return false;
    }
  }

  /**
   * Salta a la siguiente canción
   * Delega a PlayerService y QueueManagementService
   * Retorna la canción que se está reproduciendo ahora (para notificar al usuario)
   */
  async skip(guildId: string): Promise<Song | null> {
    try {
      const session = VoiceConnectionService.getSession(guildId);
      if (!session) return null;

      // Detener current playback
      PlayerService.skip(guildId);

      // Obtener siguiente canción de la cola
      const nextSong = await QueueManagementService.dequeue(guildId);

      // Get remaining count before publishing event
      const snapshot = QueueManagementService.getSnapshot(guildId);
      const remaining = snapshot.songs.length;

      let nowPlaying: Song | null = null;

      if (nextSong) {
        const streamSource = await AudioStreamService.resolve(
          nextSong.url,
          guildId
        );
        const stream = await AudioStreamService.createStream(streamSource);
        await PlayerService.play(session, nextSong, stream);

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

        // Publish dequeue event to stream
        const bridge = getMusicQueueEventBridge();
        bridge
          .publishDequeue(
            guildId,
            {
              title: nextSong.title,
              url: nextSong.url,
              duration: nextSong.duration,
            },
            remaining
          )
          .catch((err) => {
            logger.warn({ error: err.message }, "Stream dequeue event failed");
          });

        // Convertir a formato Song para retornar
        nowPlaying = {
          title: nextSong.title,
          url: nextSong.url,
          duration: nextSong.duration,
          thumbnail: nextSong.thumbnail,
          requester: nextSong.requester,
        };
      }

      logger.info({ guildId }, "Song skipped via facade");
      return nowPlaying;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error skipping via facade"
      );
      return null;
    }
  }

  /**
   * Pausa la reproducción
   * Delega a PlayerService
   */
  pause(guildId: string): boolean {
    try {
      PlayerService.pause(guildId);
      logger.info({ guildId }, "Playback paused via facade");
      return true;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error pausing via facade"
      );
      return false;
    }
  }

  /**
   * Reanuda la reproducción
   * Delega a PlayerService
   */
  resume(guildId: string): boolean {
    try {
      PlayerService.resume(guildId);
      logger.info({ guildId }, "Playback resumed via facade");
      return true;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error resuming via facade"
      );
      return false;
    }
  }

  /**
   * Ajusta el volumen
   * Delega a PlayerService y QueueManagementService
   */
  setVolume(guildId: string, volume: number): boolean {
    try {
      const normalizedVolume = Math.max(0, Math.min(200, volume));

      // Actualizar en QueueManagementService
      QueueManagementService.setVolume(guildId, normalizedVolume);

      // Aplicar volumen en PlayerService
      PlayerService.setVolume(guildId, normalizedVolume / 100);

      logger.info(
        { guildId, volume: normalizedVolume },
        "Volume set via facade"
      );
      return true;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error setting volume via facade"
      );
      return false;
    }
  }

  /**
   * Configura el modo de repetición
   * Delega a QueueManagementService
   */
  setLoop(guildId: string, mode: LoopMode): boolean {
    try {
      QueueManagementService.setLoopMode(guildId, mode);
      logger.info({ guildId, mode }, "Loop mode set via facade");
      return true;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error setting loop mode via facade"
      );
      return false;
    }
  }

  /**
   * Obtiene la cola de un servidor
   * Delega a QueueManagementService y VoiceConnectionService
   */
  getQueue(guildId: string): MusicQueue | undefined {
    try {
      const session = VoiceConnectionService.getSession(guildId);
      if (!session) return undefined;

      // Usar getSnapshot que es síncrono para mantener backward compatibility
      const queueSnapshot = QueueManagementService.getSnapshot(guildId);

      // Reconstruct legacy MusicQueue format for backward compatibility
      const queue: MusicQueue = {
        guildId,
        textChannel: session.textChannel,
        voiceChannel: session.voiceChannel,
        connection: session.connection,
        player: session.player,
        songs: queueSnapshot.songs,
        currentSong: queueSnapshot.currentSong,
        isPlaying: queueSnapshot.isPlaying,
        isPaused: queueSnapshot.isPaused,
        volume: queueSnapshot.volume,
        loopMode: queueSnapshot.loopMode,
        history: [],
      };

      return queue;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error getting queue via facade"
      );
      return undefined;
    }
  }

  /**
   * Limpia la cola sin detener la canción actual
   * Delega a QueueManagementService
   */
  async clearSongs(guildId: string): Promise<number> {
    try {
      const snapshot = await QueueManagementService.serialize(guildId);
      const count = snapshot?.songs.length ?? 0;

      await QueueManagementService.clear(guildId);

      // Publish clear event to stream
      const bridge = getMusicQueueEventBridge();
      bridge.publishClear(guildId, count).catch((err) => {
        logger.warn({ error: err.message }, "Stream clear event failed");
      });

      logger.info({ guildId, count }, "Queue cleared via facade");
      return count;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error clearing songs via facade"
      );
      return 0;
    }
  }

  /**
   * Elimina una canción de la cola
   * Delega a QueueManagementService
   */
  async removeSong(guildId: string, index: number): Promise<Song | null> {
    return this.removeSongAsync(guildId, index);
  }

  /**
   * Versión async de removeSong para uso interno
   */
  async removeSongAsync(guildId: string, index: number): Promise<Song | null> {
    try {
      const snapshot = QueueManagementService.getSnapshot(guildId);
      const removed = await QueueManagementService.remove(guildId, index);

      // Publish remove event to stream
      if (removed) {
        const bridge = getMusicQueueEventBridge();
        bridge
          .publishRemove(
            guildId,
            index,
            {
              title: removed.title,
              url: removed.url,
            },
            snapshot.songs.length - 1
          )
          .catch((err) => {
            logger.warn({ error: err.message }, "Stream remove event failed");
          });
      }

      logger.info(
        { guildId, index, title: removed?.title },
        "Song removed via facade"
      );
      return removed;
    } catch (error) {
      logger.error(
        {
          guildId,
          index,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error removing song via facade"
      );
      return null;
    }
  }

  /**
   * Mezcla la cola aleatoriamente
   * Delega a QueueManagementService
   */
  shuffle(guildId: string): boolean {
    try {
      // Usar getSnapshot que es síncrono para mantener backward compatibility
      const snapshot = QueueManagementService.getSnapshot(guildId);
      if (!snapshot || snapshot.songs.length < 2) return false;

      // Delegar al método shuffle del servicio
      QueueManagementService.shuffle(guildId);

      logger.info({ guildId }, "Queue shuffled via facade");
      return true;
    } catch (error) {
      logger.error(
        {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error shuffling queue via facade"
      );
      return false;
    }
  }

  /**
   * Limpia la cola después de una desconexión (memoria únicamente)
   * Delega a VoiceConnectionService
   */
  cleanQueueAfterDisconnect(guildId: string): void {
    try {
      VoiceConnectionService.cleanupSession(guildId);
      logger.info("Queue cleaned after disconnect via facade", { guildId });
    } catch (error) {
      logger.error("Error cleaning queue after disconnect", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Limpia la cola completamente
   * Delega a VoiceConnectionService y QueueManagementService
   */
  clearQueue(guildId: string): void {
    try {
      // Limpiar sesión de voz
      VoiceConnectionService.cleanupSession(guildId);
      // Limpiar cola
      QueueManagementService.clear(guildId);
      logger.info("Queue cleared via facade", { guildId });
    } catch (error) {
      logger.error("Error clearing queue", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

const musicService = new MusicService();
export default musicService;
