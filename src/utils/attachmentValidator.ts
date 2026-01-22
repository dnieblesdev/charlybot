// src/utils/attachmentValidator.ts
import { AttachmentBuilder } from "discord.js";
import type { Attachment } from "discord.js";
import logger from "./logger.ts";

export interface ValidationResult {
  success: boolean;
  attachment?: AttachmentBuilder;
  error?: string;
}

export interface ValidationStats {
  totalProcessed: number;
  successfullyValidated: number;
  failed: number;
  totalSize: number;
}

/**
 * Valida que un attachment sea una imagen válida
 */
export function isValidImageAttachment(attachment: Attachment): boolean {
  // Verificar tipo de contenido
  if (!attachment.contentType?.startsWith("image/")) {
    return false;
  }

  // Verificar que tenga tamaño
  if (!attachment.size || attachment.size === 0) {
    return false;
  }

  // Verificar tamaño máximo (25MB límite de Discord)
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  if (attachment.size > MAX_SIZE) {
    return false;
  }

  return true;
}

/**
 * Descarga y valida un attachment individual
 */
export async function downloadAndValidateAttachment(
  attachment: Attachment,
  context?: { userId?: string; guildId?: string }
): Promise<ValidationResult> {
  try {
    // Validación básica
    if (!isValidImageAttachment(attachment)) {
      return {
        success: false,
        error: `Invalid attachment: ${attachment.name}`,
      };
    }

    logger.debug("Downloading attachment", {
      fileName: attachment.name,
      size: attachment.size,
      contentType: attachment.contentType,
      ...context,
    });

    // Descargar el archivo con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

    const response = await fetch(attachment.url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const bufferData = Buffer.from(buffer);

    // Verificar que el buffer no esté vacío
    if (bufferData.length === 0) {
      logger.warn("Downloaded file is empty", {
        fileName: attachment.name,
        originalSize: attachment.size,
        downloadedSize: bufferData.length,
        ...context,
      });
      return {
        success: false,
        error: `File downloaded empty: ${attachment.name}`,
      };
    }

    // Verificar que el tamaño coincida (con tolerancia del 5% o 1KB, lo que sea mayor)
    const tolerance = Math.max(1024, (attachment.size || 0) * 0.05);
    const sizeDifference = Math.abs(bufferData.length - (attachment.size || 0));

    if (sizeDifference > tolerance) {
      logger.warn("Significant file size mismatch", {
        fileName: attachment.name,
        originalSize: attachment.size,
        downloadedSize: bufferData.length,
        difference: sizeDifference,
        tolerance,
        ...context,
      });

      // Si la diferencia es muy grande, considerar como error
      if (sizeDifference > (attachment.size || 0) * 0.5) {
        return {
          success: false,
          error: `File size mismatch too large: ${attachment.name}`,
        };
      }
    }

    // Verificar que sea realmente una imagen (magic bytes básicos)
    if (!isValidImageBuffer(bufferData)) {
      logger.warn("File does not contain valid image data", {
        fileName: attachment.name,
        ...context,
      });
      return {
        success: false,
        error: `Invalid image data: ${attachment.name}`,
      };
    }

    logger.debug("File validated successfully", {
      fileName: attachment.name,
      originalSize: attachment.size,
      downloadedSize: bufferData.length,
      ...context,
    });

    return {
      success: true,
      attachment: new AttachmentBuilder(bufferData, { name: attachment.name }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Failed to download and validate attachment", {
      fileName: attachment.name,
      url: attachment.url,
      error: errorMessage,
      ...context,
    });

    return {
      success: false,
      error: `Download failed: ${errorMessage}`,
    };
  }
}

/**
 * Procesa múltiples attachments de forma segura
 */
export async function processAttachments(
  attachments: Attachment[],
  context?: { userId?: string; guildId?: string }
): Promise<{
  validAttachments: AttachmentBuilder[];
  stats: ValidationStats;
  errors: string[];
}> {
  const validAttachments: AttachmentBuilder[] = [];
  const errors: string[] = [];
  const stats: ValidationStats = {
    totalProcessed: attachments.length,
    successfullyValidated: 0,
    failed: 0,
    totalSize: 0,
  };

  // Filtrar attachments de imagen válidos primero
  const imageAttachments = attachments.filter(isValidImageAttachment);

  if (imageAttachments.length === 0) {
    errors.push("No valid image attachments found");
    return { validAttachments, stats, errors };
  }

  // Procesar cada attachment
  for (const attachment of imageAttachments) {
    const result = await downloadAndValidateAttachment(attachment, context);

    if (result.success && result.attachment) {
      validAttachments.push(result.attachment);
      stats.successfullyValidated++;
      stats.totalSize += attachment.size || 0;
    } else {
      stats.failed++;
      if (result.error) {
        errors.push(result.error);
      }
    }
  }

  logger.info("Attachment processing completed", {
    ...stats,
    errorCount: errors.length,
    ...context,
  });

  return { validAttachments, stats, errors };
}

/**
 * Verifica si un buffer contiene datos de imagen válidos usando magic bytes
 */
function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // Verificar magic bytes para formatos comunes
  const firstBytes = buffer.slice(0, 4);

  // PNG: 89 50 4E 47
  if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 &&
      firstBytes[2] === 0x4E && firstBytes[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
    return true;
  }

  // GIF: 47 49 46 38
  if (firstBytes[0] === 0x47 && firstBytes[1] === 0x49 &&
      firstBytes[2] === 0x46 && firstBytes[3] === 0x38) {
    return true;
  }

  // WebP: verificar "RIFF" al inicio y "WEBP" en posición 8-11
  if (buffer.length >= 12) {
    const riff = buffer.slice(0, 4);
    const webp = buffer.slice(8, 12);
    if (riff.toString() === "RIFF" && webp.toString() === "WEBP") {
      return true;
    }
  }

  return false;
}

/**
 * Convierte bytes a formato legible
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
