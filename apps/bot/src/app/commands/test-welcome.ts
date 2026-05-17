import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import { listSocialLinks } from "../../config/repositories/SocialLinkRepo.ts";
import { listWelcomeCustomVars } from "../../config/repositories/WelcomeCustomVarRepo.ts";
import { formatWelcomeMessage } from "../events/guildMemberAdd.ts";
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

    await interaction.deferReply();
    const config = await getGuildConfig(interaction.guild.id);
    const welcomeChannelId = config?.welcomeChannelId;

    // Validar que el canal de bienvenida esté configurado
    if (!validateChannelConfigured(welcomeChannelId, "bienvenida", "set-welcome")) {
      await interaction.editReply(createErrorReply(ERROR_MESSAGES.CHANNEL_NOT_CONFIGURED("bienvenida", "set-welcome")));
      return;
    }

    if (!config?.welcomeMessage) {
      await interaction.editReply({
        content: "❌ No hay mensaje de bienvenida configurado. Usa `/set-welcome` para configurar el mensaje.",
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(
      welcomeChannelId!,
    );
    if (!channel) {
      await interaction.editReply({
        content: "❌ No pude encontrar el canal configurado.",
      });
      return;
    }

    // Fetch custom vars and social links, then use the same formatter as the real event
    const [customVars, socialLinks] = await Promise.all([
      listWelcomeCustomVars(interaction.guild.id),
      listSocialLinks(interaction.guild.id),
    ]);

    // Build a fake GuildMember-like object for the preview
    const previewMember = {
      toString: () => interaction.user.toString(),
      user: interaction.user,
      guild: interaction.guild,
    } as any;

    const preview = formatWelcomeMessage(
      config!.welcomeMessage,
      previewMember,
      customVars,
      socialLinks,
    );

    // Enviar al canal configurado
    await (channel as any).send({ content: preview });

    await interaction.editReply({
      content: `✅ Mensaje de bienvenida enviado de prueba a <#${welcomeChannelId}>.`,
    });
  } catch (error) {
    logger.error("Error executing test-welcome command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Error ejecutando test-welcome." });
    } else {
      await interaction.reply({ content: "❌ Error ejecutando test-welcome.", flags: [MessageFlags.Ephemeral] });
    }
  }
}
