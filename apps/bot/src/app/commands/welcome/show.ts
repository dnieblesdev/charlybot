import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";

import { getGuildConfig } from "../../../config/repositories/GuildConfigRepo.ts";
import { listWelcomeCustomVars } from "../../../config/repositories/WelcomeCustomVarRepo.ts";
import { listSocialLinks } from "../../../config/repositories/SocialLinkRepo.ts";
import { logCommand } from "../../../utils/logger.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "welcome show",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const guildId = interaction.guild.id;
    const [config, customVars, socialLinks] = await Promise.all([
      getGuildConfig(guildId),
      listWelcomeCustomVars(guildId),
      listSocialLinks(guildId),
    ]);

    const embed = new EmbedBuilder()
      .setTitle("📋 Configuración de Bienvenida")
      .setColor(0x2ecc71);

    // Welcome channel
    if (config?.welcomeChannelId) {
      const channel = interaction.guild.channels.cache.get(config.welcomeChannelId);
      embed.addFields({
        name: "📢 Canal de Bienvenida",
        value: channel ? `<#${config.welcomeChannelId}>` : `<#${config.welcomeChannelId}> (canal no encontrado)`,
        inline: true,
      });
    } else {
      embed.addFields({
        name: "📢 Canal de Bienvenida",
        value: "⚠️ **No configurado**",
        inline: true,
      });
    }

    // Welcome message
    if (config?.welcomeMessage) {
      const truncated =
        config.welcomeMessage.length > 200
          ? config.welcomeMessage.slice(0, 200) + "..."
          : config.welcomeMessage;
      embed.addFields({
        name: "💬 Mensaje de Bienvenida",
        value: truncated,
        inline: false,
      });
    } else {
      embed.addFields({
        name: "💬 Mensaje de Bienvenida",
        value: "⚠️ **No configurado** (se usará embed por defecto)",
        inline: false,
      });
    }

    // Custom variables count
    embed.addFields({
      name: "🔧 Variables Personalizadas",
      value: customVars.size > 0 ? `**${customVars.size}** configurada(s)` : "Ninguna",
      inline: true,
    });

    // Social links count
    embed.addFields({
      name: "🔗 Enlaces Sociales",
      value: socialLinks.size > 0 ? `**${socialLinks.size}** configurado(s)` : "Ninguno",
      inline: true,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "❌ Error al obtener la configuración de bienvenida.",
      });
    } else {
      await interaction.reply({
        content: "❌ Error al obtener la configuración de bienvenida.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}