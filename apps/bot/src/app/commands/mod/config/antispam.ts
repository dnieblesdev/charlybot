import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from "discord.js";

import * as AntiSpamConfigRepo from "../../../../config/repositories/AntiSpamConfigRepo.js";
import { update as updateGuildConfig } from "../../../../config/repositories/GuildConfigRepo.js";
import { canModerate, MODERATION_ACTION } from "../../../services/ModGuardService.js";
import logger from "../../../../utils/logger.js";

// Map pattern keys to human-readable names
const PATTERN_NAMES: Record<string, string> = {
  burst: "Ráfaga de mensajes",
  duplicate: "Mensajes duplicados",
  mention: "Menciones excesivas",
  link: "Enlaces",
  caps: "MAYÚSCULAS",
  emoji: "Emojis excesivos",
  combo: "Combo de patrones",
};

// Map action keys to human-readable names
const ACTION_NAMES: Record<string, string> = {
  warn: "Warn",
  timeout_5min: "Timeout 5 min",
  timeout_30min: "Timeout 30 min",
  notify_only: "Solo notificar",
  delete_only: "Solo eliminar",
};

const PATTERNS = ["burst", "duplicate", "mention", "link", "caps", "emoji", "combo"] as const;
const ACTIONS = ["warn", "timeout_5min", "timeout_30min", "notify_only", "delete_only"] as const;

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
  const config = await AntiSpamConfigRepo.getByGuildId(guildId);

  const embed = new EmbedBuilder().setTitle("🛡️ Configuración Anti-Spam").setColor(0x3498db);

  // Master toggle
  const masterStatus = config?.enabled ? "✅ Activado" : "❌ Desactivado";
  embed.addFields({ name: "Estado general", value: masterStatus, inline: true });

  // Per-pattern status
  embed.addFields({
    name: "Patrones anti-spam",
    value:
      PATTERNS.map((p) => {
        const patternName = PATTERN_NAMES[p];
        const enabled = config ? (config as Record<string, unknown>)[`${p}Enabled`] as boolean : true;
        const action = config ? (config as Record<string, unknown>)[`${p}Action`] as string : "warn";
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
    embed.setDescription("⚠️ No hay configuración guardada. Se usarán los valores por defecto.");
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
  const enabled = estado === "Activar";

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
  const nombre = interaction.options.getString("nombre", true) as (typeof PATTERNS)[number];
  const estado = interaction.options.getString("estado", true);
  const enabled = estado === "Activar";

  if (!PATTERNS.includes(nombre)) {
    await interaction.editReply({
      content: `❌ Patrón no válido. Opciones: ${PATTERNS.join(", ")}`,
    });
    return;
  }

  const updateKey = `${nombre}Enabled`;
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
  const nombre = interaction.options.getString("nombre", true) as (typeof PATTERNS)[number];
  const accion = interaction.options.getString("accion", true) as (typeof ACTIONS)[number];

  if (!PATTERNS.includes(nombre)) {
    await interaction.editReply({
      content: `❌ Patrón no válido. Opciones: ${PATTERNS.join(", ")}`,
    });
    return;
  }

  if (!ACTIONS.includes(accion)) {
    await interaction.editReply({
      content: `❌ Acción no válida. Opciones: ${ACTIONS.join(", ")}`,
    });
    return;
  }

  const updateKey = `${nombre}Action`;
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
  const enabled = estado === "Activar";
  const cantidad = interaction.options.getInteger("cantidad", false);

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
