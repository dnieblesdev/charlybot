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
    case "add":
      await addLevelRole(interaction);
      break;
    case "list":
      await listLevelRoles(interaction);
      break;
    case "remove":
      await removeLevelRole(interaction);
      break;
    default:
      await interaction.reply({
        content: "Subcomando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
  }
}

async function addLevelRole(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "xp level-roles add",
    );

    // Verificar permisos de admin
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const hasPermission = member?.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      await interaction.reply({
        content: "❌ No tienes permisos para gestionar roles por nivel.",
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

    const level = interaction.options.getInteger("nivel", true);
    const role = interaction.options.getRole("rol", true);
    const guildId = interaction.guildId;

    // Verificar que el rol existe en el servidor
    const guildRole = interaction.guild?.roles.cache.get(role.id);
    if (!guildRole) {
      await interaction.editReply({
        content: "❌ El rol especificado no existe en este servidor.",
      });
      return;
    }

    // Crear la asociación nivel-rol
    await xpAdapter.createLevelRole(guildId, level, role.id);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Rol asociado a nivel")
      .addFields(
        {
          name: "Nivel",
          value: `**${level}**`,
          inline: true,
        },
        {
          name: "Rol",
          value: `${role.name}`,
          inline: true,
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Level role added: level ${level} -> role ${role.id}`, {
      guildId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error adding level role", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al associating el rol con el nivel.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}

async function listLevelRoles(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "xp level-roles list",
    );

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply();

    const guildId = interaction.guildId;
    const levelRoles = await xpAdapter.getLevelRoles(guildId);

    if (levelRoles.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle("📋 Roles por Nivel")
        .setDescription("No hay roles asociados a niveles en este servidor.")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Ordenar por nivel
    const sortedRoles = [...levelRoles].sort((a, b) => a.level - b.level);

    // Crear fields para cada nivel
    const fields = await Promise.all(
      sortedRoles.map(async (lr) => {
        const role = interaction.guild?.roles.cache.get(lr.roleId);
        return {
          name: `Nivel ${lr.level}`,
          value: role ? `${role.name}` : `<@&${lr.roleId}> (rol no encontrado)`,
          inline: true,
        };
      }),
    );

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("📋 Roles por Nivel")
      .setDescription(
        "Lista de roles que se otorgan al alcanzar ciertos niveles:",
      )
      .addFields(fields)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info("Level roles listed", {
      guildId,
      userId: interaction.user.id,
      count: levelRoles.length,
    });
  } catch (error) {
    logger.error("Error listing level roles", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al listar los roles por nivel.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}

async function removeLevelRole(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "xp level-roles remove",
    );

    // Verificar permisos de admin
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const hasPermission = member?.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!hasPermission) {
      await interaction.reply({
        content: "❌ No tienes permisos para gestionar roles por nivel.",
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

    const level = interaction.options.getInteger("nivel", true);
    const guildId = interaction.guildId;

    // Verificar que existe la asociación
    const levelRoles = await xpAdapter.getLevelRoles(guildId);
    const existingRole = levelRoles.find((lr) => lr.level === level);

    if (!existingRole) {
      await interaction.editReply({
        content: `❌ No existe un rol asociado al nivel ${level}.`,
      });
      return;
    }

    // Eliminar la asociación
    await xpAdapter.deleteLevelRole(guildId, level);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🗑️ Rol eliminado del nivel")
      .addFields(
        {
          name: "Nivel",
          value: `**${level}**`,
          inline: true,
        },
      )
      .setDescription("La asociación de rol para este nivel ha sido eliminada.")
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Level role removed: level ${level}`, {
      guildId,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Error removing level role", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al eliminar el rol del nivel.";
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({
        content: errorMessage,
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}
