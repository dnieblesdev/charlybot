import { Events, Guild } from "discord.js";
import logger from "../../utils/logger";
import { upsertGuild } from "../../config/repositories/GuildConfigRepo.ts";

export default {
  name: Events.GuildCreate,
  once: false,
  async execute(guild: Guild) {
    // Fetch owner in its own try/catch — failure shouldn't block guild registration
    let ownerId: string | null = null;
    let ownerUsername: string | null = null;

    try {
      const owner = await guild.fetchOwner();
      ownerId = owner.id;
      ownerUsername = owner.user.username;
    } catch (err) {
      logger.warn(`Could not fetch owner for guild ${guild.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      await upsertGuild(guild.id, {
        guildId: guild.id,
        name: guild.name,
        MemberCount: guild.memberCount ?? 0,
        ownerId,
        ownerName: ownerUsername,
      });

      logger.info(`✅ Guild registrado: ${guild.name}`, {
        guildId: guild.id,
        memberCount: guild.memberCount ?? 0,
      });
    } catch (err) {
      logger.error(`Error al registrar guild ${guild.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
};
