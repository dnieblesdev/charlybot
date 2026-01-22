import type { ChatInputCommandInteraction } from "discord.js";

/**
 * Verifica si el usuario es el propietario del bot
 */
export function isOwner(userId: string): boolean {
  const ownerId = process.env.OWNER_ID;

  if (!ownerId) {
    console.warn("⚠️ OWNER_ID no está configurado en .env");
    return false;
  }

  return userId === ownerId;
}

/**
 * Verifica si el usuario de la interacción es el propietario
 */
export function isOwnerInteraction(interaction: ChatInputCommandInteraction): boolean {
  return isOwner(interaction.user.id);
}

/**
 * Lista de usernames de propietarios (para logging)
 */
export const OWNER_USERNAME = "niel30";
