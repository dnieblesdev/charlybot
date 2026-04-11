import { Client, Events } from "discord.js";
import logger from "../../utils/logger";
import { upsertGuild } from "../../config/repositories/GuildConfigRepo.ts";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    logger.info(`✅ Bot conectado como ${client.user?.tag}`);
    logger.info(`📊 Servidores activos: ${client.guilds.cache.size}`);
    // registrar / actualizar todos los registros en la BD
    try {
      const guilds = client.guilds;

      // Process guilds concurrently with per-guild error isolation
      await Promise.all(
        guilds.cache.map(async (guild) => {
          try {
            const fullGuild = await guild.fetch();
            if (fullGuild.features.includes("COMMUNITY")) {
              logger.info(
                `✅ Servidor ${fullGuild.vanityURLCode} es un servidor de comunidad`,
              );
            }
            const owner = await guild.fetchOwner();
            const ownerUsername = owner.user.username;

            await upsertGuild(guild.id, {
              guildId: guild.id,
              name: guild.name,
              MemberCount: guild.memberCount,
              ownerId: owner.id,
              ownerName: ownerUsername,
            });
          } catch (err) {
            logger.error(`Failed to sync guild ${guild.id}`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
    } catch (error) {
      logger.error("Error al actualizar registros en la BD", error);
    }
  },
};
