import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import type { IAntiSpamAction, IAntiSpamConfig, IAntiSpamPattern } from "@charlybot/shared/schemas/antispam";

import * as AntiSpamConfigRepo from "../../../../config/repositories/AntiSpamConfigRepo.js";
import { DEFAULT_ANTI_SPAM_PATTERN_ACTIONS } from "../../../../config/repositories/AntiSpamConfigRepo.js";
import { update as updateGuildConfig } from "../../../../config/repositories/GuildConfigRepo.js";
import { canModerate, MODERATION_ACTION } from "../../../services/ModGuardService.js";
import logger from "../../../../utils/logger.js";

const ANTI_SPAM_STATE = {
  DISABLED: "disabled",
  ENABLED: "enabled",
} as const;

type AntiSpamState = (typeof ANTI_SPAM_STATE)[keyof typeof ANTI_SPAM_STATE];

const PATTERN_NAMES: Record<IAntiSpamPattern, string> = {
  burst: "Ráfaga de mensajes",
  duplicate: "Mensajes duplicados",
  mention: "Menciones excesivas",
  link: "Enlaces",
  caps: "MAYÚSCULAS",
  emoji: "Emojis excesivos",
  combo: "Combo de patrones",
};

const ACTION_NAMES: Record<IAntiSpamAction, string> = {
  warn: "Warn",
  timeout_5min: "Timeout 5 min",
  timeout_30min: "Timeout 30 min",
  notify_only: "Solo notificar",
  delete_only: "Solo eliminar",
};

const PATTERNS = ["burst", "duplicate", "mention", "link", "caps", "emoji", "combo"] as const satisfies readonly IAntiSpamPattern[];
const ACTIONS = ["warn", "timeout_5min", "timeout_30min", "notify_only", "delete_only"] as const satisfies readonly IAntiSpamAction[];

type AntiSpamPatternKey = (typeof PATTERNS)[number];
type AntiSpamEnabledField = Extract<keyof IAntiSpamConfig, `${AntiSpamPatternKey}Enabled`>;
type AntiSpamActionField = Extract<keyof IAntiSpamConfig, `${AntiSpamPatternKey}Action`>;

function parseEnabledState(value: string | null): boolean | null {
  if (value === ANTI_SPAM_STATE.ENABLED) {
    return true;
  }

  if (value === ANTI_SPAM_STATE.DISABLED) {
    return false;
  }

  return null;
}

function isValidPattern(value: string): value is AntiSpamPatternKey {
  return PATTERNS.includes(value as AntiSpamPatternKey);
}

function isValidAction(value: string): value is IAntiSpamAction {
  return ACTIONS.includes(value as IAntiSpamAction);
}

export default async function antispam(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    const subcomando = interaction.options.getString("subcomando", true);

    switch (subcomando) {
      case "view":
        await viewConfig(interaction);
        break;
      case "toggle":
        await toggleMaster(interaction);
        break;
      case "pattern":
        await configurePattern(interaction);
        break;
      case "action":
        await configureAction(interaction);
        break;
      case "escalation":
        await configureEscalation(interaction);
        break;
      default:
        await interaction.editReply({
          content: "❌ Subcomando no reconocido.",
        });
    }
  } catch (error) {
    logger.error("Error executing /mod config antispam", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al procesar el comando. Inténtalo de nuevo.",
    });
  }
}

async function viewConfig(interaction: ChatInputCommandInteraction) {
  const modCheck = await canModerate(interaction, MODERATION_ACTION.CONFIG);
  if (!modCheck.allowed) {
    await interaction.editReply({ content: `❌ ${modCheck.reason}` });
    return;
  }

  const guildId = interaction.guildId!;
  const config = await AntiSpamConfigRepo.getCachedByGuildId(guildId);

  const embed = new EmbedBuilder().setTitle("🛡️ Configuración Anti-Spam").setColor(0x3498db);

  // Master toggle
  const masterStatus = config?.enabled !== false ? "✅ Activado" : "❌ Desactivado";
  embed.addFields({ name: "Estado general", value: masterStatus, inline: true });

  // Per-pattern status
  embed.addFields({
    name: "Patrones anti-spam",
    value:
      PATTERNS.map((p) => {
        const patternName = PATTERN_NAMES[p];
         const enabled = config ? config[`${p}Enabled` as AntiSpamEnabledField] : true;
         const action = config ? config[`${p}Action` as AntiSpamActionField] : DEFAULT_ANTI_SPAM_PATTERN_ACTIONS[p];
         return `${patternName}: ${enabled ? "✅" : "❌"} — ${ACTION_NAMES[action] || action}`;
       })
        .join("\n") || "Ninguno",
    inline: false,
  });

  // Escalation
  const escalationStatus =
    config?.escalationEnabled !== false ? "✅ Activado" : "❌ Desactivado";
  const escalationCount = config?.escalationCount ?? 3;
  embed.addFields({
    name: "Escalado",
    value: `${escalationStatus} (después de ${escalationCount} infracciones)`,
    inline: true,
  });

  if (!config) {
    embed.setDescription("⚠️ No hay configuración guardada. Por defecto, el anti-spam queda habilitado con acciones base seguras.");
  }

  embed.setFooter({ text: "Usa /mod config antispam para modificar la configuración" });

  await interaction.editReply({ embeds: [embed] });
}

async function toggleMaster(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ Solo los **administradores** pueden cambiar la configuración anti-spam.",
    });
    return;
  }

  const guildId = interaction.guildId!;
  const estado = interaction.options.getString("estado", true);
  const enabled = parseEnabledState(estado);

  if (enabled === null) {
    await interaction.editReply({
      content: "❌ Estado no válido. Usá únicamente las opciones habilitado o deshabilitado.",
    });
    return;
  }

  await AntiSpamConfigRepo.update(guildId, { enabled });
  await updateGuildConfig(guildId, { antispamEnabled: enabled });

  await interaction.editReply({
    content: `${enabled ? "✅" : "🛑"} Sistema anti-spam ${enabled ? "activado" : "desactivado"} correctamente.`,
  });

  logger.info("Anti-spam master toggled via config", {
    userId: interaction.user.id,
    guildId,
    enabled,
  });
}

async function configurePattern(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ Solo los **administradores** pueden cambiar la configuración anti-spam.",
    });
    return;
  }

  const guildId = interaction.guildId!;
  const nombre = interaction.options.getString("nombre", true);
  const estado = interaction.options.getString("estado", true);
  const enabled = parseEnabledState(estado);

  if (!isValidPattern(nombre)) {
    await interaction.editReply({
      content: `❌ Patrón no válido. Opciones: ${PATTERNS.join(", ")}`,
    });
    return;
  }

  if (enabled === null) {
    await interaction.editReply({
      content: "❌ Estado no válido. Usá únicamente las opciones habilitado o deshabilitado.",
    });
    return;
  }

  const updateKey = `${nombre}Enabled` as AntiSpamEnabledField;
  await AntiSpamConfigRepo.update(guildId, { [updateKey]: enabled });

  await interaction.editReply({
    content: `${enabled ? "✅" : "❌"} Patrón **${PATTERN_NAMES[nombre]}** ${enabled ? "activado" : "desactivado"}.`,
  });

  logger.info("Anti-spam pattern toggled via config", {
    userId: interaction.user.id,
    guildId,
    pattern: nombre,
    enabled,
  });
}

async function configureAction(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ Solo los **administradores** pueden cambiar la configuración anti-spam.",
    });
    return;
  }

  const guildId = interaction.guildId!;
  const nombre = interaction.options.getString("nombre", true);
  const accion = interaction.options.getString("accion", true);

  if (!isValidPattern(nombre)) {
    await interaction.editReply({
      content: `❌ Patrón no válido. Opciones: ${PATTERNS.join(", ")}`,
    });
    return;
  }

  if (!isValidAction(accion)) {
    await interaction.editReply({
      content: `❌ Acción no válida. Opciones: ${ACTIONS.join(", ")}`,
    });
    return;
  }

  const updateKey = `${nombre}Action` as AntiSpamActionField;
  await AntiSpamConfigRepo.update(guildId, { [updateKey]: accion });

  await interaction.editReply({
    content: `✅ Acción para **${PATTERN_NAMES[nombre]}** configurada: **${ACTION_NAMES[accion]}**.`,
  });

  logger.info("Anti-spam action configured via config", {
    userId: interaction.user.id,
    guildId,
    pattern: nombre,
    action: accion,
  });
}

async function configureEscalation(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply({
      content: "❌ Solo los **administradores** pueden cambiar la configuración anti-spam.",
    });
    return;
  }

  const guildId = interaction.guildId!;
  const estado = interaction.options.getString("estado", true);
  const enabled = parseEnabledState(estado);
  const cantidad = interaction.options.getInteger("cantidad", false);

  if (enabled === null) {
    await interaction.editReply({
      content: "❌ Estado no válido. Usá únicamente las opciones habilitado o deshabilitado.",
    });
    return;
  }

  const updateData: Record<string, unknown> = { escalationEnabled: enabled };
  if (cantidad !== null && cantidad !== undefined) {
    updateData.escalationCount = cantidad;
  }

  await AntiSpamConfigRepo.update(guildId, updateData);

  const parts: string[] = [`${enabled ? "✅" : "❌"} Escalado ${enabled ? "activado" : "desactivado"}`];
  if (cantidad !== null && cantidad !== undefined) {
    parts.push(` → ${cantidad} infracciones antes de escalar`);
  }

  await interaction.editReply({ content: parts.join("") });

  logger.info("Anti-spam escalation configured via config", {
    userId: interaction.user.id,
    guildId,
    enabled,
    escalationCount: cantidad,
  });
}
