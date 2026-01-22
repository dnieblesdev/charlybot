import { Client, Events } from "discord.js";
import logger from "../../utils/logger";
import { prisma } from "../../infrastructure/storage";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    logger.info(`✅ Bot conectado como ${client.user?.tag}`);
    logger.info(`📊 Servidores activos: ${client.guilds.cache.size}`);
    // registrar / actualizar todos los registros en la BD
    try {
      const guilds = client.guilds;

      for (const guild of guilds.cache.values()) {
        const fullGuild = await guild.fetch();
        if (fullGuild.features.includes("COMMUNITY")) {
          logger.info(
            `✅ Servidor ${fullGuild.vanityURLCode} es un servidor de comunidad`,
          );
        }
        const owner = await guild.fetchOwner();
        const ownerUsername = owner.user.username;
        await prisma.guild.upsert({
          where: { guildId: guild.id },
          update: {
            name: guild.name,
            MemberCount: guild.memberCount,
            ownerId: owner.id,
            ownerName: ownerUsername,
          },
          create: {
            guildId: guild.id,
            name: guild.name,
            MemberCount: guild.memberCount,
            ownerId: owner.id,
            ownerName: ownerUsername,
          },
        });
      }
    } catch (error) {
      logger.error("Error al actualizar registros en la BD", error);
    }
  },
};
