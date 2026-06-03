import { Events, Guild } from "discord.js";
import logger from "../../utils/logger";
import { deleteGuild } from "../../config/repositories/GuildConfigRepo.ts";

export default {
  name: Events.GuildDelete,
  once: false,
  async execute(guild: Guild) {
    // Skip unavailable guilds (Discord outage) — don't delete data
    if (!guild.available) {
      logger.info(
        `⏭️ Guild unavailable (outage), skipping deletion: ${guild.id}`
      );
      return;
    }

    try {
      await deleteGuild(guild.id);

      logger.info(
        {
          guildId: guild.id,
        },
        `🗑️ Guild eliminado: ${guild.name}`
      );
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err),
        },
        `Error al eliminar guild ${guild.id}`
      );
    }
  },
};
