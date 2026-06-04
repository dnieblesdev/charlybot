import type {
  ChatInputCommandInteraction,
  GuildMember,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo";
import logger from "../../utils/logger";

export const MODERATION_ACTION = {
  WARN: "warn",
  TIMEOUT: "timeout",
  KICK: "kick",
  BAN: "ban",
  UNBAN: "unban",
  REASON: "reason",
  CASES: "cases",
  CONFIG: "config",
} as const;

export type ModerationAction = (typeof MODERATION_ACTION)[keyof typeof MODERATION_ACTION];

type ModerationInteraction =
  | ChatInputCommandInteraction
  | UserContextMenuCommandInteraction;

const ACTION_PERMISSION_REQUIREMENTS: Partial<Record<ModerationAction, bigint>> = {
  [MODERATION_ACTION.TIMEOUT]: PermissionFlagsBits.ModerateMembers,
  [MODERATION_ACTION.KICK]: PermissionFlagsBits.KickMembers,
  [MODERATION_ACTION.BAN]: PermissionFlagsBits.BanMembers,
  [MODERATION_ACTION.UNBAN]: PermissionFlagsBits.BanMembers,
};

const ACTION_PERMISSION_LABELS: Partial<Record<ModerationAction, string>> = {
  [MODERATION_ACTION.TIMEOUT]: "Moderate Members",
  [MODERATION_ACTION.KICK]: "Kick Members",
  [MODERATION_ACTION.BAN]: "Ban Members",
  [MODERATION_ACTION.UNBAN]: "Ban Members",
};

/**
 * Verifica que el miembro tenga el rol de mod configurado O sea admin.
 */
export async function canModerate(
  interaction: ModerationInteraction,
  action: ModerationAction = MODERATION_ACTION.WARN,
): Promise<{ allowed: boolean; reason?: string }> {
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member) {
    return { allowed: false, reason: "No se pudo verificar el miembro" };
  }

  const guildConfig = await getGuildConfig(interaction.guildId!);
  const modRoleId = guildConfig?.modRoleId;
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

  if (isAdmin) {
    return { allowed: true };
  }

  // Si no hay modRoleId configurado, solo admins pueden moderar
  if (!modRoleId) {
    return {
      allowed: false,
      reason: "No hay rol de moderador configurado y no sos administrador",
    };
  }

  // Si hay modRoleId, verificar que el miembro lo tenga
  const hasModRole = member.roles.cache.has(modRoleId);
  if (!hasModRole) {
    return { allowed: false, reason: "No tenés permisos de moderador" };
  }

  const requiredPermission = ACTION_PERMISSION_REQUIREMENTS[action];
  if (requiredPermission && !member.permissions.has(requiredPermission)) {
    const permissionLabel = ACTION_PERMISSION_LABELS[action] ?? "correspondiente";

    return {
      allowed: false,
      reason: `Necesitás el permiso **${permissionLabel}** para esta acción de moderación`,
    };
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
