import type { MessageFlags } from 'discord.js';

/**
 * Valida que un canal esté configurado.
 * @returns true si el canal está configurado, false si no
 */
export function validateChannelConfigured(
  channelId: string | null | undefined,
  channelType: string,
  setCommand: string
): boolean {
  return !!channelId;
}

/**
 * Valida que un sistema esté habilitado (enabled).
 * @returns true si está habilitado, false si no
 */
export function validateSystemEnabled(
  enabled: boolean | null | undefined,
  systemName: string,
  enableCommand: string
): boolean {
  return enabled === true;
}

/**
 * Valida que el sistema de XP esté habilitado para eventos (optimizado para evitar llamadas API).
 * Esta función está diseñada para usar en eventos de mensajes donde cada llamada cuenta.
 * 
 * @returns 'enabled' si el sistema está activo, 'disabled' si no lo está, 'unknown' si necesita consultar la API
 */
export function validateXPForEvent(xpConfig: { enabled: boolean } | null | undefined): 'enabled' | 'disabled' | 'unknown' {
  if (!xpConfig) return 'unknown';
  return xpConfig.enabled ? 'enabled' : 'disabled';
}

/**
 * Mensajes de error normalizados
 */
export const ERROR_MESSAGES = {
  CHANNEL_NOT_CONFIGURED: (action: string, setCommand: string) => 
    `❌ **Canal no configurado:** No hay un canal configurado para ${action}. Un administrador debe usar \`/${setCommand}\` primero.`,

  SYSTEM_DISABLED: (systemName: string, enableCommand: string) =>
    `❌ **Sistema desactivado:** El sistema de ${systemName} está desactivado en este servidor. Un administrador debe usar \`/${enableCommand}\` para activarlo.`,

  VERIFICATION_NOT_CONFIGURED: () =>
    `❌ **Sistema no configurado:** El sistema de verificación no está configurado. Un administrador debe usar \`/verificacion setup\` primero.`,
} as const;

/**
 * Reply options factory para mensajes de error (para deferReply seguido de editReply)
 */
export const createErrorReply = (content: string): { content: string } => ({
  content,
});