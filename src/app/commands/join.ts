import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction, GuildMember } from "discord.js";
import { ChannelType } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";
import musicService from "../services/MusicService.ts";

export const data = new SlashCommandBuilder()
  .setName("join")
  .setDescription("Une el bot a tu canal de voz");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "join");

    // Verificar que el comando se ejecute en un servidor
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
      return;
    }

    // Verificar que el usuario esté en un canal de voz
    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz para usar este comando.",
        ephemeral: true,
      });
      return;
    }

    // Verificar que sea un canal de voz válido
    if (
      voiceChannel.type !== ChannelType.GuildVoice &&
      voiceChannel.type !== ChannelType.GuildStageVoice
    ) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz válido.",
        ephemeral: true,
      });
      return;
    }

    // Verificar permisos del bot
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions?.has("Connect") || !permissions?.has("Speak")) {
      await interaction.reply({
        content:
          "❌ No tengo permisos para conectarme o hablar en ese canal de voz.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    // Obtener el canal de texto actual
    const textChannel = interaction.channel;
    if (!textChannel || !textChannel.isTextBased()) {
      await interaction.editReply({
        content: "❌ No se pudo identificar el canal de texto.",
      });
      return;
    }

    // Unirse al canal de voz
    await musicService.join(
      interaction.guildId,
      voiceChannel,
      textChannel as any,
    );

    await interaction.editReply({
      content: `✅ Me uní a **${voiceChannel.name}**`,
    });

    logger.info("Join command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: voiceChannel.id,
      channelName: voiceChannel.name,
    });
  } catch (error) {
    logger.error("Error executing join command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al intentar unirme al canal de voz.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
