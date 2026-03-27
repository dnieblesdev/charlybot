/**
 * Music Services Index - Exports y Factory
 * 
 * Punto de entrada para los servicios de música:
 * - VoiceConnectionService: gestión de conexiones de voz
 * - AudioStreamService: resolución y stream de audio
 * - QueueManagementService: gestión de colas
 * - PlayerService: control de reproducción
 * 
 * @example
 * import { VoiceConnectionService, createMusicServices } from "./music/index";
 * 
 * const services = createMusicServices();
 */

export * from "./types";

// Re-exportar tipos para convenience
export type {
  Song,
  Track,
  LoopMode,
  StreamOptions,
  VoiceSession,
  StreamSource,
  QueueSnapshot,
  PlaybackResult,
  PlaybackError,
  PlaybackErrorCode,
  PlaybackStartedEvent,
  PlaybackEndedEvent,
  PlaybackErrorEvent,
} from "./types";

// Re-exportar servicios - import directly
import { VoiceConnectionService as VCS, createVoiceConnectionService } from "./VoiceConnectionService";
export const VoiceConnectionService = VCS;
export { createVoiceConnectionService } from "./VoiceConnectionService";

// Re-exportar types desde el servicio
export type { VoiceSession as VoiceSessionType } from "./types";

/**
 * AudioStreamService - Resolución y stream de audio
 * 
 * Responsabilidades:
 * - Resolver queries a fuentes de stream
 * - Crear streams de audio
 * - Validar formatos y límites
 * - Manejo de errores con retry
 * 
 * @example
 * const source = await AudioStreamService.resolve("song name", guildId);
 * const stream = await AudioStreamService.createStream(source, { volume: 0.5 });
 */
import {
  AudioStreamService as ASS,
  createAudioStreamService,
  AudioStreamError,
  SearchError,
  StreamCreationError,
  ValidationError,
} from "./AudioStreamService";

export const AudioStreamService = ASS;
export { createAudioStreamService } from "./AudioStreamService";

// Re-exportar errores
export { AudioStreamError, SearchError, StreamCreationError, ValidationError } from "./AudioStreamService";

/**
 * QueueManagementService - Gestión de colas de reproducción
 * 
 * Responsabilidades:
 * - Enqueue/dequeue de canciones
 * - Modos de loop y shuffle
 * - Serialización para persistencia
 * - Buffer callbacks
 * 
 * @example
 * await QueueManagementService.enqueue(guildId, track);
 * const next = await QueueManagementService.dequeue(guildId);
 * const snapshot = await QueueManagementService.serialize(guildId);
 */
import {
  QueueManagementService as QMS,
  getQueueManagementService,
} from "./QueueManagementService";

export const QueueManagementService = QMS;
export { getQueueManagementService } from "./QueueManagementService";

/**
 * PlayerService - Control de reproducción de audio
 * 
 * Responsabilidades:
 * - Iniciar/detener reproducción
 * - Pause/resume/skip
 * - Ajuste de volumen
 * - Eventos de playback (Started, Ended, Error)
 * - Integración con VoiceConnectionService
 * 
 * @example
 * await PlayerService.play(voiceSession, song, stream);
 * PlayerService.pause(guildId);
 * PlayerService.skip(guildId);
 */
import {
  PlayerService as PSI,
  createPlayerService,
  type EventHandlers,
} from "./PlayerService";

export const PlayerService = PSI;
export { createPlayerService };
export type { EventHandlers };

// ============================================================================
// Factory Function
// ============================================================================

export interface MusicServices {
  voice: typeof VoiceConnectionService;
  stream: typeof AudioStreamService;
  queue: typeof QueueManagementService;
  player: typeof PlayerService;
}

/**
 * Crea una instancia de los servicios de música
 * 
 * @example
 * const services = createMusicServices();
 * const { voice, stream, queue, player } = services;
 */
export function createMusicServices(): MusicServices {
  return {
    voice: VoiceConnectionService,
    stream: AudioStreamService,
    queue: QueueManagementService,
    player: PlayerService,
  };
}

// ============================================================================
// Instancia singleton (para backward compatibility)
// ============================================================================

/**
 * Instancia por defecto de los servicios
 */
export const musicServices = createMusicServices();