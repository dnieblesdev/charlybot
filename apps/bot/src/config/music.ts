export interface MusicConfig {
  // Playlist processing limits
  maxPlaylistTracks: number;
  playlistBatchSize: number;
  batchDelayMs: number;

  // Stream settings
  maxStreamRetries: number;
  streamTimeoutMs: number;
  connectionTimeoutMs: number;

  // Search settings
  searchTimeoutMs: number;
  searchRetryDelay: number;

  // Audio quality settings
  defaultQuality: number;
  fallbackQualities: number[];

  // Performance settings
  enableConcurrentProcessing: boolean;
  maxConcurrentSearches: number;
  rateLimitDelayMs: number;
}

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  // Playlist limits - optimizado para balance entre velocidad y estabilidad
  maxPlaylistTracks: 50,
  playlistBatchSize: 5,
  batchDelayMs: 1500,

  // Stream configuration - timeouts más agresivos para evitar colgadas
  maxStreamRetries: 3,
  streamTimeoutMs: 15000,
  connectionTimeoutMs: 5000,

  // Search optimization - timeouts balanceados
  searchTimeoutMs: 8000,
  searchRetryDelay: 500,

  // Audio quality - mejor calidad con fallbacks
  defaultQuality: 1, // Alta calidad
  fallbackQualities: [2, 1, 0], // Media, Alta, Baja

  // Performance - procesamiento optimizado
  enableConcurrentProcessing: true,
  maxConcurrentSearches: 5,
  rateLimitDelayMs: 500,
};

export const QUICK_MODE_CONFIG: MusicConfig = {
  ...DEFAULT_MUSIC_CONFIG,
  // Configuración más rápida para playlists grandes
  maxPlaylistTracks: 25,
  playlistBatchSize: 8,
  batchDelayMs: 1000,
  searchTimeoutMs: 6000,
  maxConcurrentSearches: 8,
  rateLimitDelayMs: 300,
};

export const QUALITY_MODE_CONFIG: MusicConfig = {
  ...DEFAULT_MUSIC_CONFIG,
  // Configuración más estable para mejor calidad
  maxPlaylistTracks: 100,
  playlistBatchSize: 3,
  batchDelayMs: 2000,
  searchTimeoutMs: 12000,
  maxStreamRetries: 5,
  maxConcurrentSearches: 3,
  rateLimitDelayMs: 1000,
};

// Detectar modo basado en tamaño de playlist
export function getOptimalConfig(playlistSize: number): MusicConfig {
  if (playlistSize <= 10) {
    return DEFAULT_MUSIC_CONFIG;
  } else if (playlistSize <= 30) {
    return QUICK_MODE_CONFIG;
  } else {
    return QUALITY_MODE_CONFIG;
  }
}

// Configuración de mensajes para el usuario
export const MUSIC_MESSAGES = {
  PLAYLIST_TOO_LARGE: (total: number, limit: number) =>
    `⚠️ Playlist tiene ${total} tracks, procesando solo los primeros ${limit} para evitar demoras.`,

  PROCESSING_BATCH: (current: number, total: number) =>
    `🔄 Procesando lote ${current}/${total}...`,

  BATCH_COMPLETE: (successful: number, failed: number) =>
    `✅ Lote completado: ${successful} exitosos, ${failed} fallidos`,

  PLAYLIST_COMPLETE: (successful: number, total: number, timeMs: number) =>
    `🎉 Playlist procesada: ${successful}/${total} tracks en ${(timeMs/1000).toFixed(1)}s`,

  STREAM_RETRY: (attempt: number, max: number) =>
    `🔄 Reintentando stream (${attempt}/${max})...`,

  CONNECTION_WAIT: "⏳ Esperando conexión de voz estable...",

  RATE_LIMIT_PAUSE: "⏱️ Pausa para evitar rate limiting...",
};

// Configuración de logging
export const MUSIC_LOG_LEVELS = {
  PLAYLIST_START: "info",
  BATCH_PROGRESS: "debug",
  TRACK_SUCCESS: "debug",
  TRACK_FAILURE: "debug",
  STREAM_ERROR: "warn",
  CONNECTION_ERROR: "error",
} as const;
