import {
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import type { GuildMember } from "discord.js";

import { getGuildConfig } from "../../../config/repositories/GuildConfigRepo.ts";
import { listWelcomeCustomVars } from "../../../config/repositories/WelcomeCustomVarRepo.ts";
import { listSocialLinks } from "../../../config/repositories/SocialLinkRepo.ts";
import { formatWelcomeMessage } from "../../events/guildMemberAdd.ts";
import logger, { logCommand } from "../../../utils/logger.ts";
import {
  validateChannelConfigured,
  ERROR_MESSAGES,
  createErrorReply,
} from "../../../utils/validation.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "welcome test",
    );

    if (!interaction.guild) {
      await interaction.reply({
        content: "❌ Solo en servidores.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const config = await getGuildConfig(interaction.guild.id);
    const welcomeChannelId = config?.welcomeChannelId;

    // Validate channel is configured
    if (!validateChannelConfigured(welcomeChannelId, "bienvenida", "welcome channel")) {
      await interaction.editReply(createErrorReply(ERROR_MESSAGES.CHANNEL_NOT_CONFIGURED("bienvenida", "welcome channel")));
      return;
    }

    if (!config?.welcomeMessage) {
      await interaction.editReply({
        content: "❌ No hay mensaje de bienvenida configurado. Usa `/welcome message` para configurar el mensaje.",
      });
      return;
    }

    const channel = interaction.guild.channels.cache.get(welcomeChannelId!);
    if (!channel) {
      await interaction.editReply({
        content: "❌ No pude encontrar el canal configurado.",
      });
      return;
    }

    // Fetch custom vars and social links
    const [customVars, socialLinks] = await Promise.all([
      listWelcomeCustomVars(interaction.guild.id),
      listSocialLinks(interaction.guild.id),
    ]);

    // Build fake GuildMember-like object for the preview
    // We only need toString, user, and guild for formatWelcomeMessage
    const previewMember = {
      toString: () => interaction.user.toString(),
      user: interaction.user,
      guild: interaction.guild,
    } as unknown as GuildMember;

    const preview = formatWelcomeMessage(
      config!.welcomeMessage,
      previewMember,
      customVars,
      socialLinks,
    );

    // Send to configured channel
    await (channel as any).send({ content: preview });

    await interaction.editReply({
      content: `✅ Mensaje de bienvenida enviado de prueba a <#${welcomeChannelId}>.`,
    });
  } catch (error) {
    logger.error("Error executing welcome test command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: "❌ Error ejecutando welcome test." });
    } else {
      await interaction.reply({
        content: "❌ Error ejecutando welcome test.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }
}