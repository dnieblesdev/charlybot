import { Events, TextChannel } from "discord.js";
import type { GuildMember } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";

function formatWelcomeMessage(template: string, member: GuildMember) {
  // Placeholders simples que puedes ampliar: {user}, {username}, {server}
  return template
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name);
}

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    try {
      const guildId = member.guild.id;
      const config = await getGuildConfig(guildId);
      if (!config) return;

      const channelId = config.welcomeChannelId;
      const messageTemplate = config.welcomeMessage;

      if (!channelId || !messageTemplate) return;

      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) return;

      // Asegurarse de que el canal soporte send
      if (!(channel instanceof TextChannel) && !channel.isThread()) {
        logger.warn("Welcome channel is not a text channel", {
          guildId,
          channelId,
        });
        return;
      }

      const finalMessage = formatWelcomeMessage(messageTemplate, member);

      await (channel as TextChannel).send({ content: finalMessage });

      logger.info("Welcome message sent", {
        guildId,
        channelId,
        userId: member.id,
      });
    } catch (error) {
      logger.error("Error sending welcome message", {
        error: error instanceof Error ? error.message : String(error),
        guildId: member.guild?.id,
      });
    }
  },
};
