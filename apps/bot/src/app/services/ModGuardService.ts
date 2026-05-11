import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo";
import logger from "../../utils/logger";

/**
 * Verifica que el miembro tenga el rol de mod configurado O sea admin.
 */
export async function canModerate(
  interaction: ChatInputCommandInteraction,
): Promise<{ allowed: boolean; reason?: string }> {
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member) {
    return { allowed: false, reason: "No se pudo verificar el miembro" };
  }

  const guildConfig = await getGuildConfig(interaction.guildId!);
  const modRoleId = guildConfig?.modRoleId;

  // Si no hay modRoleId configurado, solo admins pueden moderar
  if (!modRoleId) {
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) {
      return {
        allowed: false,
        reason: "No hay rol de moderador configurado y no sos administrador",
      };
    }
    return { allowed: true };
  }

  // Si hay modRoleId, verificar que el miembro lo tenga
  const hasModRole = member.roles.cache.has(modRoleId);
  if (!hasModRole) {
    return { allowed: false, reason: "No tenés permisos de moderador" };
  }

  return { allowed: true };
}

/**
 * Verifica jerarquía de roles: el moderador debe tener rol más alto que el target.
 */
export function canTargetModerator(
  modMember: GuildMember,
  targetMember: GuildMember,
): { allowed: boolean; reason?: string } {
  const modHighest = modMember.roles.highest;
  const targetHighest = targetMember.roles.highest;

  if (targetHighest.position >= modHighest.position) {
    return {
      allowed: false,
      reason: "No podés moderar a alguien con un rol igual o superior al tuyo",
    };
  }

  return { allowed: true };
}

/**
 * Self-mod check: un mod no puede moderarse a sí mismo.
 */
export function canTargetSelf(
  modId: string,
  targetId: string,
): { allowed: boolean; reason?: string } {
  if (modId === targetId) {
    return { allowed: false, reason: "No podés moderarte a vos mismo" };
  }

  return { allowed: true };
}

/**
 * Bot hierarchy check: el bot no puede actuar sobre alguien con rol igual o superior.
 */
export function canBotAct(
  botMember: GuildMember,
  targetMember: GuildMember,
): { allowed: boolean; reason?: string } {
  const botHighest = botMember.roles.highest;
  const targetHighest = targetMember.roles.highest;

  if (targetHighest.position >= botHighest.position) {
    return {
      allowed: false,
      reason: "No puedo moderar a alguien con un rol igual o superior al mío",
    };
  }

  return { allowed: true };
}
