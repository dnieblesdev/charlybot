import { Guild, Events } from "discord.js";
import logger from "../../utils/logger";
import { prisma } from "../../infrastructure/storage";

export default {
  name: Events.GuildCreate,
  once: false,
  async execute(guild: Guild) {
    try {
      const existsBefore = await prisma.guild.findUnique({
        where: { guildId: guild.id },
      });
      const ownerUsername = await guild
        .fetchOwner()
        .then((owner) => owner.user.username);
      const result = await prisma.guild.upsert({
        where: { guildId: guild.id },
        update: {
          name: guild.name,
          ownerId: guild.ownerId,
          MemberCount: guild.memberCount,
          ownerName: ownerUsername,
        },
        create: {
          guildId: guild.id,
          name: guild.name,
          ownerId: guild.ownerId,
          ownerName: ownerUsername,
          MemberCount: guild.memberCount,
          guildConfigs: {
            create: {},
          },
        },
      });
      if (!existsBefore) {
        logger.info(
          "🎉 Bot agregado a un nuevo servidor - Servidor registrado en la BD",
          {
            guildId: guild.id,
            guildName: guild.name,
            guildOwner: guild.ownerId,
            guildOwnerUsername: ownerUsername,
            guildMemberCount: guild.memberCount,
          },
        );
      } else {
        logger.info(
          "🔄 El Bot a re-ingresado a un servidor - Actualizando Registros en la BD",
          {
            guildId: guild.id,
            guildName: guild.name,
            guildOwner: guild.ownerId,
            guildOwnerUsername: ownerUsername,
            guildMemberCount: guild.memberCount,
          },
        );
      }
    } catch (error) {
      logger.error("❌ Error al registrar servidor", {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
