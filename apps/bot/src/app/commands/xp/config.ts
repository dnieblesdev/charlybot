import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { HttpXPAdapter } from "../../../infrastructure/api/HttpXPAdapter.js";

const xpAdapter = new HttpXPAdapter();

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "set-xp":
      await setXP(interaction);
      break;
    case "enable":
      await enableXP(interaction);
      break;
    case "disable":
      await disableXP(interaction);
      break;
    case "show":
      await showConfig(interaction);
      break;
    default:
      await interaction.reply({
        content: "Subcomando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
  }
}

async function setXP(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "xp config set-xp");

    // Verificar permisos de admin
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const hasPermission = member?.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      await interaction.reply({
        content: "❌ No tienes permisos para configurar el sistema de XP.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const xpAmount = interaction.options.getInteger("cantidad", true);
    const guildId = interaction.guildId;

    // Obtener o crear config
    let config = await xpAdapter.getConfig(guildId);

    if (!config) {
      // Crear config con valores por defecto
      config = await xpAdapter.createConfig(guildId, {
        guildId,
        xpPerMessage: xpAmount,
        enabled: true,
        levelUpChannelId: null,
        levelUpMessage: null,
      });
    } else {
      // Actualizar solo xpPerMessage
      config = await xpAdapter.updateConfig(guildId, { xpPerMessage: xpAmount });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("✅ Configuración de XP actualizada")
      .addFields(
        {
          name: "XP por mensaje",
          value: `Se estableció en **${xpAmount} XP**`,
          inline: true,
        },
        {
          name: "Sistema",
          value: config.enabled ? "🟢 Habilitado" : "🔴 Deshabilitado",
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`XP per message set to ${xpAmount}`, {
      guildId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error setting XP config", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al configurar el sistema de XP.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}

async function enableXP(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "xp config enable");

    // Verificar permisos de admin
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const hasPermission = member?.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      await interaction.reply({
        content: "❌ No tienes permisos para configurar el sistema de XP.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;

    // Obtener o crear config
    let config = await xpAdapter.getConfig(guildId);

    if (!config) {
      config = await xpAdapter.createConfig(guildId, {
        guildId,
        xpPerMessage: 1,
        enabled: true,
        levelUpChannelId: null,
        levelUpMessage: null,
      });
    } else {
      config = await xpAdapter.updateConfig(guildId, { enabled: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Sistema de XP habilitado")
      .setDescription("El sistema de XP ahora está activo en este servidor.")
      .addFields(
        {
          name: "XP por mensaje",
          value: `${config.xpPerMessage} XP`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info("XP system enabled", {
      guildId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error enabling XP system", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al habilitar el sistema de XP.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}

async function disableXP(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "xp config disable");

    // Verificar permisos de admin
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const hasPermission = member?.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      await interaction.reply({
        content: "❌ No tienes permisos para configurar el sistema de XP.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;

    // Obtener config
    let config = await xpAdapter.getConfig(guildId);

    if (!config) {
      config = await xpAdapter.createConfig(guildId, {
        guildId,
        xpPerMessage: 1,
        enabled: false,
        levelUpChannelId: null,
        levelUpMessage: null,
      });
    } else {
      config = await xpAdapter.updateConfig(guildId, { enabled: false });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔴 Sistema de XP deshabilitado")
      .setDescription("El sistema de XP ha sido desactivado en este servidor.")
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info("XP system disabled", {
      guildId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error disabling XP system", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al deshabilitar el sistema de XP.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}

async function showConfig(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "xp config show");

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;
    const config = await xpAdapter.getConfig(guildId);

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("⚙️ Configuración de XP")
      .addFields(
        {
          name: "Estado",
          value: config?.enabled ? "🟢 Habilitado" : "🔴 Deshabilitado",
          inline: true,
        },
        {
          name: "XP por mensaje",
          value: `${config?.xpPerMessage || 1} XP`,
          inline: true,
        },
      )
      .setTimestamp();

    if (config?.levelUpChannelId) {
      embed.addFields({
        name: "Canal de level up",
        value: `<#${config.levelUpChannelId}>`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    logger.info("XP config shown", {
      guildId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error showing XP config", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al mostrar la configuración de XP.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
