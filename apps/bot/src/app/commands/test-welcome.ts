import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger, { logCommand } from "../../utils/logger.ts";
import {
  validateChannelConfigured,
  ERROR_MESSAGES,
  createErrorReply,
} from "../../utils/validation.ts";

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
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const config = await getGuildConfig(interaction.guild.id);
    const welcomeChannelId = config?.welcomeChannelId;

    // Validar que el canal de bienvenida esté configurado
    if (!validateChannelConfigured(welcomeChannelId, "bienvenida", "set-welcome")) {
      await interaction.reply(createErrorReply(ERROR_MESSAGES.CHANNEL_NOT_CONFIGURED("bienvenida", "set-welcome")));
      return;
    }

    if (!config?.welcomeMessage) {
      await interaction.reply({
        content: "❌ No hay mensaje de bienvenida configurado. Usa `/set-welcome` para configurar el mensaje.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(
      welcomeChannelId!,
    );
    if (!channel) {
      await interaction.reply({
        content: "❌ No pude encontrar el canal configurado.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Reemplazar placeholders con valores de prueba
    const preview = config!.welcomeMessage
      .replace(/{user}/g, interaction.user.toString())
      .replace(/{username}/g, interaction.user.username)
      .replace(/{server}/g, interaction.guild.name);

    // Enviar al canal configurado
    await (channel as any).send({ content: preview });

    await interaction.reply({
      content: `✅ Mensaje de bienvenida enviado de prueba a <#${welcomeChannelId}>.`,
      flags: [MessageFlags.Ephemeral],
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
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}
