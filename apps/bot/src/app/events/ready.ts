import { Client, Events } from "discord.js";
import logger from "../../utils/logger";
import { upsertGuild } from "../../config/repositories/GuildConfigRepo.ts";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    logger.info(`✅ Bot conectado como ${client.user?.tag}`);
    logger.info(`📊 Servidores activos: ${client.guilds.cache.size}`);

    // Registrar / actualizar todos los registros en la BD
    const guilds = [...client.guilds.cache.values()];

    for (const guild of guilds) {
      try {
        const fullGuild = await guild.fetch();
        if (fullGuild.features.includes("COMMUNITY")) {
          logger.info(
            `✅ Servidor ${fullGuild.vanityURLCode} es un servidor de comunidad`
          );
        }

        // Fetch owner in its own try/catch — failure shouldn't block guild registration
        let ownerId: string | null = null;
        let ownerUsername: string | null = null;

        try {
          const owner = await guild.fetchOwner();
          ownerId = owner.id;
          ownerUsername = owner.user.username;
        } catch (err) {
          logger.warn(
            {
              error: err instanceof Error ? err.message : String(err),
            },
            `Could not fetch owner for guild ${guild.id}`
          );
        }

        await upsertGuild(guild.id, {
          guildId: guild.id,
          name: guild.name,
          MemberCount: guild.memberCount,
          ownerId,
          ownerName: ownerUsername,
        });

        logger.info(
          {
            guildId: guild.id,
          },
          `✅ Guild sincronizado: ${guild.name}`
        );
      } catch (err) {
        logger.error(
          {
            error: err instanceof Error ? err.message : String(err),
          },
          `Failed to sync guild ${guild.id}`
        );
      }
    }
  },
};
