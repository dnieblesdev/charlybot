import { Events, TextChannel } from "discord.js";
import type { GuildMember } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import logger from "../../utils/logger.ts";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    try {
      const guildId = member.guild.id;
      const config = await getGuildConfig(guildId);
      if (!config) return;

      const channelId = config.leaveLogChannelId;
      if (!channelId) return;

      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) return;

      if (!(channel instanceof TextChannel) && !channel.isThread()) {
        logger.warn("Leave log channel is not a text channel", {
          guildId,
          channelId,
        });
        return;
      }

      const message = `🚪 Usuario salido: ${member.user.tag} (${member.id})`;

      await (channel as TextChannel).send({ content: message });

      logger.info("Leave log message sent", {
        guildId,
        channelId,
        userId: member.id,
      });
    } catch (error) {
      logger.error("Error sending leave log message", {
        error: error instanceof Error ? error.message : String(error),
        guildId: member.guild?.id,
      });
    }
  },
};
