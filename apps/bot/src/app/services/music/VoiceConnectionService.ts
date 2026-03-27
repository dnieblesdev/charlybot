/**
 * VoiceConnectionService - Gestión de conexiones de voz por guild
 * 
 * Responsabilidades:
 * - Unirse a canales de voz (join)
 * - Desconectar y limpiar recursos (leave)
 * - Mantener sesiones de voz por guild (getSession/getState)
 * - Reconexión automática en desconexiones
 * - Cleanup seguro de recursos
 * 
 * Este servicio forma parte de la arquitectura de servicios de música:
 * - VoiceConnectionService: conexiones de voz
 * - AudioStreamService: resolución y stream de audio
 * - QueueManagementService: gestión de colas
 * - PlayerService: control de reproducción
 */

import {
  joinVoiceChannel,
  createAudioPlayer,
  VoiceConnection,
  AudioPlayer,
  entersState,
  VoiceConnectionStatus,
  type AudioResource,
} from "@discordjs/voice";
import type { VoiceChannel, StageChannel, TextChannel } from "discord.js";
import type { VoiceSession } from "./types";
import logger from "../../../utils/logger";
import {
  DEFAULT_MUSIC_CONFIG,
  MUSIC_MESSAGES,
  type MusicConfig,
} from "../../../config/music";

// ============================================================================
// Interfaces Internas
// ============================================================================

interface VoiceSessionState {
  session: VoiceSession;
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannel: TextChannel;
  voiceChannel: VoiceChannel | StageChannel;
  reconnectAttempts: number;
}

// ============================================================================
// Configuración
// ============================================================================

const DEFAULT_RECONNECT_MAX_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY_MS = 5000;

// ============================================================================
// VoiceConnectionService - Implementación
// ============================================================================

class VoiceConnectionServiceImpl {
  private sessions = new Map<string, VoiceSessionState>();
  private config: MusicConfig;
  private reconnectMaxAttempts: number;
  private reconnectDelayMs: number;

  constructor(
    config: MusicConfig = DEFAULT_MUSIC_CONFIG,
    reconnectMaxAttempts: number = DEFAULT_RECONNECT_MAX_ATTEMPTS,
    reconnectDelayMs: number = DEFAULT_RECONNECT_DELAY_MS
  ) {
    this.config = config;
    this.reconnectMaxAttempts = reconnectMaxAttempts;
    this.reconnectDelayMs = reconnectDelayMs;
  }

  // ============================================================================
  // 2.1 Estructura básica - Constructor y dependencias
  // ============================================================================

  /**
   * Une el bot a un canal de voz y crea una sesión de voz
   * 
   * @param guildId - ID del servidor
   * @param voiceChannel - Canal de voz al que unirse
   * @param textChannel - Canal de texto para mensajes
   * @returns Promise<VoiceSession> - Sesión de voz establecida
   */
  async join(
    guildId: string,
    voiceChannel: VoiceChannel | StageChannel,
    textChannel: TextChannel
  ): Promise<VoiceSession> {
    logger.info("🎤 Intentando unirse al canal de voz", {
      guildId,
      channelId: voiceChannel.id,
      channelName: voiceChannel.name,
    });

    try {
      // Verificar si hay una sesión existente válida
      const existingSession = this.sessions.get(guildId);
      if (existingSession) {
        const connectionState = existingSession.connection.state.status;

        // Si la conexión está en un estado válido y es el mismo canal, reutilizarla
        if (
          connectionState !== VoiceConnectionStatus.Destroyed &&
          connectionState !== VoiceConnectionStatus.Disconnected &&
          existingSession.voiceChannel.id === voiceChannel.id
        ) {
          logger.info("♻️ Conexión existente reutilizada", {
            guildId,
            channelId: voiceChannel.id,
            connectionState,
          });
          return existingSession.session;
        }

        // La conexión existe pero está en mal estado o es otro canal - limpiarla
        logger.info("🧹 Limpiando conexión existente en mal estado", {
          guildId,
          connectionState,
        });
        await this.safeDestroy(guildId);
      }

      // Crear nueva conexión de voz
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      // Esperar a que la conexión esté lista
      await entersState(connection, VoiceConnectionStatus.Ready, this.config.connectionTimeoutMs);

      // Crear el reproductor de audio
      const player = createAudioPlayer();

      // Crear la sesión de voz
      const session: VoiceSession = {
        guildId,
        connection,
        player,
        textChannel,
        voiceChannel,
      };

      // Guardar el estado de la sesión
      const sessionState: VoiceSessionState = {
        session,
        connection,
        player,
        textChannel,
        voiceChannel,
        reconnectAttempts: 0,
      };

      this.sessions.set(guildId, sessionState);

      // Configurar event handlers para la conexión
      this.setupConnectionHandlers(guildId, sessionState);

      logger.info("✅ Successfully joined voice channel", {
        guildId,
        channelId: voiceChannel.id,
        channelName: voiceChannel.name,
      });

      return session;
    } catch (error) {
      logger.error("❌ Error al unirse al canal de voz", {
        guildId,
        channelId: voiceChannel.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // ============================================================================
  // 2.2 Implementar join() method - join voice channel, handle reconnection
  // ============================================================================

  /**
   * Reconecta una sesión de voz existente
   * 
   * @param guildId - ID del servidor
   * @returns Promise<VoiceSession> - Sesión reconectada
   */
  async reconnect(guildId: string): Promise<VoiceSession> {
    const sessionState = this.sessions.get(guildId);

    if (!sessionState) {
      logger.warn("No hay sesión para reconectar", { guildId });
      throw new Error("No hay sesión de voz activa para este servidor");
    }

    const { voiceChannel, textChannel } = sessionState;

    if (!voiceChannel) {
      logger.error("No hay canal de voz para reconectar", { guildId });
      throw new Error("No se puede reconectar: no hay información del canal de voz");
    }

    logger.info("🔄 Iniciando reconexión", {
      guildId,
      attempt: sessionState.reconnectAttempts + 1,
      maxAttempts: this.reconnectMaxAttempts,
    });

    // Incrementar contador de intentos
    sessionState.reconnectAttempts++;

    // Verificar si se agotaron los intentos
    if (sessionState.reconnectAttempts >= this.reconnectMaxAttempts) {
      logger.error("Máximo de intentos de reconexión alcanzado", {
        guildId,
        attempts: sessionState.reconnectAttempts,
      });
      await this.safeDestroy(guildId);
      throw new Error("No se pudo reconectar después de varios intentos");
    }

    // Intentar unirse nuevamente
    try {
      // Limpiar la conexión anterior de forma segura
      await this.safeDestroy(guildId);

      // Unirse al canal nuevamente
      const newSession = await this.join(guildId, voiceChannel, textChannel);

      logger.info("✅ Reconexión exitosa", {
        guildId,
        attempts: sessionState.reconnectAttempts,
      });

      return newSession;
    } catch (error) {
      logger.error("❌ Error en reconexión", {
        guildId,
        attempt: sessionState.reconnectAttempts,
        error: error instanceof Error ? error.message : String(error),
      });

      // Si queda algún intento, esperar y retornar error controlable
      if (sessionState.reconnectAttempts < this.reconnectMaxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, this.reconnectDelayMs));
        throw new Error("Reconexión en progreso, intente nuevamente");
      }

      await this.safeDestroy(guildId);
      throw error;
    }
  }

  // ============================================================================
  // 2.3 Implementar leave() method - disconnect and cleanup
  // ============================================================================

  /**
   * Desconecta el bot del canal de voz y limpia los recursos
   * 
   * @param guildId - ID del servidor
   * @returns Promise<void>
   */
  async leave(guildId: string): Promise<void> {
    const sessionState = this.sessions.get(guildId);

    if (!sessionState) {
      logger.debug("No hay sesión activa para leave", { guildId });
      return;
    }

    logger.info("👋 Desconectando del canal de voz", { guildId });

    try {
      // Detener el reproductor de forma segura
      if (sessionState.player) {
        sessionState.player.stop();
        logger.debug("AudioPlayer detenido", { guildId });
      }

      // Destruir la conexión de forma segura
      await this.safeDestroy(guildId);

      // Eliminar la sesión del mapa
      this.sessions.delete(guildId);

      logger.info("✅ Successfully left voice channel", { guildId });
    } catch (error) {
      logger.error("❌ Error al dejar el canal de voz", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Asegurar que la sesión se limpie aunque haya errores
      this.sessions.delete(guildId);
      throw error;
    }
  }

  // ============================================================================
  // 2.4 Implementar getSession() / getState() - retrieve current voice session
  // ============================================================================

  /**
   * Obtiene la sesión de voz activa para un guild
   * 
   * @param guildId - ID del servidor
   * @returns VoiceSession | null - Sesión activa o null
   */
  getSession(guildId: string): VoiceSession | null {
    const sessionState = this.sessions.get(guildId);
    return sessionState?.session || null;
  }

  /**
   * Obtiene el estado de la conexión de voz
   * 
   * @param guildId - ID del servidor
   * @returns Estado de la conexión o null si no hay sesión
   */
  getState(guildId: string): VoiceConnectionStatus | null {
    const sessionState = this.sessions.get(guildId);
    if (!sessionState) {
      return null;
    }
    return sessionState.connection.state.status;
  }

  /**
   * Verifica si hay una sesión activa para un guild
   * 
   * @param guildId - ID del servidor
   * @returns boolean - True si hay sesión activa
   */
  hasSession(guildId: string): boolean {
    const sessionState = this.sessions.get(guildId);
    if (!sessionState) {
      return false;
    }

    // Verificar que la conexión esté en un estado válido
    const state = sessionState.connection.state.status;
    return state !== VoiceConnectionStatus.Destroyed && state !== VoiceConnectionStatus.Disconnected;
  }

  /**
   * Obtiene todos los guilds con sesiones activas
   * 
   * @returns Array<string> - Lista de guildIds
   */
  getActiveGuilds(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ============================================================================
  // 2.5 Implement safe destroy and cleanup methods
  // ============================================================================

  /**
   * Destruye de forma segura la conexión de voz
   * 
   * @param guildId - ID del servidor
   */
  async safeDestroy(guildId: string): Promise<void> {
    const sessionState = this.sessions.get(guildId);

    if (!sessionState) {
      return;
    }

    try {
      const { connection } = sessionState;
      const currentState = connection.state.status;

      // Solo destruir si no está ya destruida
      if (currentState !== VoiceConnectionStatus.Destroyed) {
        logger.debug("Destruyendo conexión de voz", {
          guildId,
          currentState,
        });

        // Remover todos los listeners para evitar memory leaks
        connection.removeAllListeners();

        // Destruir la conexión
        connection.destroy();

        logger.debug("Conexión destruida correctamente", { guildId });
      }
    } catch (error) {
      logger.warn("Error al destruir conexión", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Limpia todos los recursos de una sesión (sin destruir la conexión)
   * 
   * @param guildId - ID del servidor
   */
  cleanupSession(guildId: string): void {
    const sessionState = this.sessions.get(guildId);

    if (!sessionState) {
      return;
    }

    logger.debug("Limpiando recursos de sesión", { guildId });

    // Remover listeners del player
    if (sessionState.player) {
      sessionState.player.removeAllListeners();
      sessionState.player.stop();
    }

    // Remover listeners de la conexión
    if (sessionState.connection) {
      sessionState.connection.removeAllListeners();
    }

    // Remover la sesión del mapa
    this.sessions.delete(guildId);

    logger.debug("Sesión limpiada correctamente", { guildId });
  }

  /**
   * Limpia todas las sesiones de forma segura (para shutdown)
   */
  async destroyAll(): Promise<void> {
    logger.info("🧹 Limpiando todas las sesiones de voz");

    const guildIds = Array.from(this.sessions.keys());

    for (const guildId of guildIds) {
      try {
        await this.leave(guildId);
      } catch (error) {
        logger.warn("Error al limpiar sesión durante destroyAll", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("✅ Todas las sesiones limpiadas");
  }

  // ============================================================================
  // 2.6 Add event handlers for connection state changes
  // ============================================================================

  /**
   * Configura los event handlers para manejar cambios de estado de la conexión
   * 
   * @param guildId - ID del servidor
   * @param sessionState - Estado de la sesión
   */
  private setupConnectionHandlers(
    guildId: string,
    sessionState: VoiceSessionState
  ): void {
    const { connection, voiceChannel } = sessionState;

    // Handler para desconexión - intentar reconectar
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.warn("⚠️ Conexión de voz desconectada", {
        guildId,
        channelId: voiceChannel.id,
      });

      try {
        // Intentar reconectar esperando un momento
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);

        logger.info("✅ Conexión reconectada automáticamente", { guildId });
      } catch (error) {
        logger.error("❌ No se pudo reconectar automáticamente", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });

        // Limpiar la sesión
        this.cleanupSession(guildId);
      }
    });

    // Handler para errores de conexión
    connection.on("error", (error) => {
      logger.error("❌ Error en conexión de voz", {
        guildId,
        error: error.message,
        stack: error.stack,
      });

      // Limpiar la sesión
      this.cleanupSession(guildId);
    });

    // Handler para cuando la conexión es destruida
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.info("🔌 Conexión de voz destruida", { guildId });
      this.sessions.delete(guildId);
    });

    logger.debug("Event handlers configurados para conexión de voz", { guildId });
  }

  // ============================================================================
  // Métodos de utilidad
  // ============================================================================

  /**
   * Obtiene el player de audio para un guild
   * 
   * @param guildId - ID del servidor
   * @returns AudioPlayer | null
   */
  getPlayer(guildId: string): AudioPlayer | null {
    const sessionState = this.sessions.get(guildId);
    return sessionState?.player || null;
  }

  /**
   * Obtiene la conexión de voz para un guild
   * 
   * @param guildId - ID del servidor
   * @returns VoiceConnection | null
   */
  getConnection(guildId: string): VoiceConnection | null {
    const sessionState = this.sessions.get(guildId);
    return sessionState?.connection || null;
  }

  /**
   * Obtiene el número de sesiones activas
   * 
   * @returns number
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// ============================================================================
// Instancia singleton
// ============================================================================

// Singleton con configuración por defecto
let voiceConnectionServiceInstance: VoiceConnectionServiceImpl | null = null;

/**
 * Obtiene la instancia singleton de VoiceConnectionService
 * 
 * @example
 * import { VoiceConnectionService } from './services/music';
 * const session = await VoiceConnectionService.join(guildId, voiceChannel, textChannel);
 */
function getVoiceConnectionService(): VoiceConnectionServiceImpl {
  if (!voiceConnectionServiceInstance) {
    voiceConnectionServiceInstance = new VoiceConnectionServiceImpl();
  }
  return voiceConnectionServiceInstance;
}

// Export como objeto con todos los métodos
export const VoiceConnectionService = {
  join: (...args: Parameters<VoiceConnectionServiceImpl['join']>) => 
    getVoiceConnectionService().join(...args),
  leave: (...args: Parameters<VoiceConnectionServiceImpl['leave']>) => 
    getVoiceConnectionService().leave(...args),
  reconnect: (...args: Parameters<VoiceConnectionServiceImpl['reconnect']>) => 
    getVoiceConnectionService().reconnect(...args),
  getState: (...args: Parameters<VoiceConnectionServiceImpl['getState']>) => 
    getVoiceConnectionService().getState(...args),
  getSession: (...args: Parameters<VoiceConnectionServiceImpl['getSession']>) => 
    getVoiceConnectionService().getSession(...args),
  hasSession: (...args: Parameters<VoiceConnectionServiceImpl['hasSession']>) => 
    getVoiceConnectionService().hasSession(...args),
  getPlayer: (...args: Parameters<VoiceConnectionServiceImpl['getPlayer']>) => 
    getVoiceConnectionService().getPlayer(...args),
  getConnection: (...args: Parameters<VoiceConnectionServiceImpl['getConnection']>) => 
    getVoiceConnectionService().getConnection(...args),
  getSessionCount: () => getVoiceConnectionService().getSessionCount(),
  getActiveGuilds: () => getVoiceConnectionService().getActiveGuilds(),
  safeDestroy: (...args: Parameters<VoiceConnectionServiceImpl['safeDestroy']>) => 
    getVoiceConnectionService().safeDestroy(...args),
  cleanupSession: (...args: Parameters<VoiceConnectionServiceImpl['cleanupSession']>) => 
    getVoiceConnectionService().cleanupSession(...args),
  destroyAll: () => getVoiceConnectionService().destroyAll(),
};

// ============================================================================
// Export named exports para compatibilidad con el índice
// ============================================================================

export const voiceJoin = VoiceConnectionService.join.bind(VoiceConnectionService);
export const voiceLeave = VoiceConnectionService.leave.bind(VoiceConnectionService);
export const voiceReconnect = VoiceConnectionService.reconnect.bind(VoiceConnectionService);
export const voiceGetState = VoiceConnectionService.getState.bind(VoiceConnectionService);
export const voiceGetSession = VoiceConnectionService.getSession.bind(VoiceConnectionService);

// ============================================================================
// Factory para testing e inyección de dependencias
// ============================================================================

/**
 * Crea una nueva instancia de VoiceConnectionService
 * Útil para testing o cuando se necesita una instancia independiente
 * 
 * @param config - Configuración opcional
 * @param reconnectMaxAttempts - Número máximo de intentos de reconexión
 * @param reconnectDelayMs - Delay entre intentos de reconexión
 * @returns Nueva instancia de VoiceConnectionService
 * 
 * @example
 * const service = createVoiceConnectionService(DEFAULT_MUSIC_CONFIG, 5, 3000);
 * const session = await service.join(guildId, voiceChannel, textChannel);
 */
export function createVoiceConnectionService(
  config?: MusicConfig,
  reconnectMaxAttempts?: number,
  reconnectDelayMs?: number
): VoiceConnectionServiceImpl {
  return new VoiceConnectionServiceImpl(config, reconnectMaxAttempts, reconnectDelayMs);
}