/**
 * Music Service Types - DTOs para la arquitectura de servicios
 * 
 * Contratos inter-servicio para:
 * - VoiceConnectionService
 * - AudioStreamService
 * - QueueManagementService
 * - PlayerService
 */

import type {
  VoiceConnection,
  AudioPlayer,
  AudioResource,
} from "@discordjs/voice";
import type { TextChannel, VoiceChannel, StageChannel } from "discord.js";

// ============================================================================
// Tipos de dominio
// ============================================================================

/**
 * Cancion cargada en la cola
 */
export interface Song {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requester: {
    id: string;
    username: string;
  };
}

/**
 * Track individual en memoria (para procesamiento interno)
 */
export interface Track {
  id: string;
  source: StreamSource;
  addedAt: Date;
  requestedBy: string;
}

/**
 * Modo de loop para la reproduccion
 */
export type LoopMode = "none" | "song" | "queue";

/**
 * Opciones para crear un stream de audio
 */
export interface StreamOptions {
  volume?: number;
  encoderArgs?: string[];
  seeking?: boolean;
  startTime?: number;
  endTime?: number;
}

// ============================================================================
// DTOs de Servicios
// ============================================================================

/**
 * Sesion de voz activa - mantiene la conexion y player juntos
 */
export interface VoiceSession {
  guildId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannel: TextChannel;
  voiceChannel: VoiceChannel | StageChannel;
}

/**
 * Fuente de stream resuelta - metadata de lo que se va a reproducir
 */
export interface StreamSource {
  url: string;
  title: string;
  duration: number;
  thumbnail?: string;
  platform: "youtube" | "spotify" | "soundcloud" | "other";
}

/**
 * Snapshot de la cola en un momento dado - para persistencia y sincronizacion
 */
export interface QueueSnapshot {
  guildId: string;
  songs: Song[];
  currentSong: Song | null;
  loopMode: LoopMode;
  volume: number;
  isPlaying: boolean;
  isPaused: boolean;
}

/**
 * Resultado de una operacion de reproduccion
 */
export interface PlaybackResult {
  success: boolean;
  song?: Song;
  error?: PlaybackError;
}

/**
 * Errores tipados para reproduccion
 */
export type PlaybackErrorCode =
  | "VOICE_NOT_CONNECTED"
  | "STREAM_FAILED"
  | "RESOURCE_FAILED"
  | "TIMEOUT"
  | "PLAYER_ERROR";

export interface PlaybackError {
  code: PlaybackErrorCode;
  message: string;
  originalError?: Error;
}

// ============================================================================
// Tipos de Eventos
// ============================================================================

/**
 * Evento cuando comienza la reproduccion
 */
export interface PlaybackStartedEvent {
  guildId: string;
  song: Song;
  timestamp: Date;
}

/**
 * Evento cuando termina la reproduccion
 */
export interface PlaybackEndedEvent {
  guildId: string;
  song: Song;
  reason: "finished" | "stopped" | "error";
  timestamp: Date;
}

/**
 * Evento cuando ocurre un error en reproduccion
 */
export interface PlaybackErrorEvent {
  guildId: string;
  error: PlaybackError;
  timestamp: Date;
}

// ============================================================================
// Utilidades de tipo
// ============================================================================

/**
 * Funcion factory para crear una sesion de voz
 */
export interface VoiceSessionFactory {
  create(
    guildId: string,
    voiceChannel: VoiceChannel | StageChannel,
    textChannel: TextChannel,
  ): Promise<VoiceSession>;
}

/**
 * Callback para cuando la cola necesita mas temas
 */
export type BufferCallback = (guildId: string) => void | Promise<void>;

/**
 * Funcion para resolver una query a StreamSource
 */
export type ResolveFunction = (
  query: string,
  guildId: string,
) => Promise<StreamSource>;

/**
 * Funcion para crear un stream de audio
 */
export type StreamFactory = (
  source: StreamSource,
  options?: StreamOptions,
) => Promise<ReadableStream<Uint8Array>>;
