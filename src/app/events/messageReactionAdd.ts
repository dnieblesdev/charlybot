import {
  MessageReaction,
  type PartialMessageReaction,
  User,
  type PartialUser,
} from "discord.js";
import logger from "../../utils/logger.js";
import * as AutoRoleRepo from "../../config/repositories/AutoRoleRepo.js";
import * as AutoRoleService from "../services/AutoRoleService.js";

export default {
  name: "messageReactionAdd",
  once: false,
  async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
    try {
      // Ignorar reacciones del bot
      if (user.bot) return;

      // Si la reacción o el mensaje son parciales, cargarlos completamente
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          logger.error("Error fetching reaction", {
            error: error instanceof Error ? error.message : String(error),
            messageId: reaction.message.id,
          });
          return;
        }
      }

      if (reaction.message.partial) {
        try {
          await reaction.message.fetch();
        } catch (error) {
          logger.error("Error fetching message", {
            error: error instanceof Error ? error.message : String(error),
            messageId: reaction.message.id,
          });
          return;
        }
      }

      const message = reaction.message;
      const guild = message.guild;

      if (!guild) return;

      // Buscar si este mensaje tiene configuración de auto-roles
      const autoRole = await AutoRoleRepo.getAutoRoleByMessageId(message.id);

      if (!autoRole) return;

      // Obtener el emoji (puede ser unicode o custom)
      const emoji = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      // Buscar el mapping correspondiente a esta reacción
      const mapping = autoRole.mappings.find(
        (m) =>
          m.type === "reaction" &&
          (m.emoji === emoji ||
            m.emoji === reaction.emoji.name ||
            m.emoji === reaction.emoji.id),
      );

      if (!mapping) {
        logger.debug("No mapping found for reaction", {
          emoji,
          messageId: message.id,
          autoRoleId: autoRole.id,
        });
        return;
      }

      // Obtener el miembro del servidor
      const member = await guild.members.fetch(user.id);
      if (!member) {
        logger.error("Could not fetch member", {
          userId: user.id,
          guildId: guild.id,
        });
        return;
      }

      // Asignar el rol
      const result = await AutoRoleService.assignRole(
        member,
        mapping.roleId,
        autoRole,
      );

      if (!result.success) {
        logger.error("Failed to assign role via reaction", {
          error: result.error,
          userId: user.id,
          roleId: mapping.roleId,
          messageId: message.id,
          autoRoleId: autoRole.id,
        });

        // Intentar quitar la reacción si falló
        try {
          await reaction.users.remove(user.id);
        } catch (error) {
          logger.error(
            "Failed to remove reaction after role assignment failure",
            {
              error: error instanceof Error ? error.message : String(error),
              userId: user.id,
              messageId: message.id,
            },
          );
        }
      } else {
        logger.info("Role assigned via reaction", {
          userId: user.id,
          username: user.username,
          roleId: mapping.roleId,
          guildId: guild.id,
          messageId: message.id,
          autoRoleId: autoRole.id,
          emoji,
        });
      }
    } catch (error) {
      logger.error("Error in messageReactionAdd handler", {
        error: error instanceof Error ? error.message : String(error),
        messageId: reaction.message.id,
        userId: user.id,
      });
    }
  },
};
