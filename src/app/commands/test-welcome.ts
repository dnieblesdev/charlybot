import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("test-welcome")
  .setDescription(
    "Envía una prueba del mensaje de bienvenida al canal configurado",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "test-welcome",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        ephemeral: true,
      });
      return;
    }

    const config = await getGuildConfig(interaction.guild.id);
    if (!config || !config.welcomeChannelId || !config.welcomeMessage) {
      await interaction.reply({
        content: "❌ No hay configuración de bienvenida en este servidor.",
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(
      config.welcomeChannelId,
    );
    if (!channel) {
      await interaction.reply({
        content: "❌ No pude encontrar el canal configurado.",
        ephemeral: true,
      });
      return;
    }

    // Reemplazar placeholders con valores de prueba
    const preview = config.welcomeMessage
      .replace(/{user}/g, interaction.user.toString())
      .replace(/{username}/g, interaction.user.username)
      .replace(/{server}/g, interaction.guild.name);

    // Enviar al canal configurado
    await (channel as any).send({ content: preview });

    await interaction.reply({
      content: `✅ Mensaje de bienvenida enviado de prueba a <#${config.welcomeChannelId}>.`,
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Error executing test-welcome command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ Error ejecutando test-welcome.",
        ephemeral: true,
      });
    }
  }
}
