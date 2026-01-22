import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta base para almacenamiento
const DATA_DIR = path.join(__dirname, "../../../data");

/**
 * Storage genérico para leer/escribir JSON
 */
export class SimpleStorage<T> {
  private filePath: string;
  private cache: T | null = null;

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
  }

  /**
   * Lee el archivo JSON
   */
  async read(): Promise<T | null> {
    // Si ya está en caché, devolverlo
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const data = await readFile(this.filePath, "utf-8");
      this.cache = JSON.parse(data) as T;
      return this.cache;
    } catch (error) {
      // Si el archivo no existe, retornar null
      if ((error as any).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Escribe el archivo JSON
   */
  async write(data: T): Promise<void> {
    try {
      // Asegurar que la carpeta data/ existe
      await mkdir(DATA_DIR, { recursive: true });

      await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
      this.cache = data; // Actualizar caché
    } catch (error) {
      console.error("❌ Error escribiendo archivo:", error);
      throw error;
    }
  }

  /**
   * Elimina el archivo
   */
  async delete(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      await fs.unlink(this.filePath);
      this.cache = null;
    } catch (error) {
      if ((error as any).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Limpia el caché (útil para forzar recarga)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Verifica si el archivo existe
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}
