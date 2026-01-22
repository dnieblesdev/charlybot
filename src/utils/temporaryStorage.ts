// Almacenamiento temporal en memoria para datos de verificación
// Se usa para mantener el nombre del juego mientras el usuario selecciona clase/subclase

interface VerificationTemp {
  inGameName: string;
  timestamp: number;
}

class TemporaryStorage {
  private storage: Map<string, VerificationTemp> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Limpiar datos antiguos cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Guarda el nombre del juego temporalmente
   */
  set(userId: string, inGameName: string): void {
    this.storage.set(userId, {
      inGameName,
      timestamp: Date.now(),
    });
  }

  /**
   * Obtiene el nombre del juego guardado
   */
  get(userId: string): string | null {
    const data = this.storage.get(userId);
    if (!data) return null;

    // Si han pasado más de 10 minutos, eliminar
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      this.storage.delete(userId);
      return null;
    }

    return data.inGameName;
  }

  /**
   * Elimina el dato temporal después de usarlo
   */
  delete(userId: string): void {
    this.storage.delete(userId);
  }

  /**
   * Limpia datos que tengan más de 10 minutos
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutos

    for (const [userId, data] of this.storage.entries()) {
      if (now - data.timestamp > maxAge) {
        this.storage.delete(userId);
      }
    }
  }

  /**
   * Limpia el interval al cerrar
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.storage.clear();
  }
}

// Exportar una instancia singleton
export const tempStorage = new TemporaryStorage();
