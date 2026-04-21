import { Events, Guild } from "discord.js";
import logger from "../../utils/logger";
import { deleteGuild } from "../../config/repositories/GuildConfigRepo.ts";

export default {
  name: Events.GuildDelete,
  once: false,
  async execute(guild: Guild) {
    // Skip unavailable guilds (Discord outage) — don't delete data
    if (!guild.available) {
      logger.info(`⏭️ Guild unavailable (outage), skipping deletion: ${guild.id}`);
      return;
    }

    try {
      await deleteGuild(guild.id);

      logger.info(`🗑️ Guild eliminado: ${guild.name}`, {
        guildId: guild.id,
      });
    } catch (err) {
      logger.error(`Error al eliminar guild ${guild.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};
