import { Events, MessageFlags } from "discord.js";
import type { Interaction, InteractionReplyOptions } from "discord.js";
import logger from "../../utils/logger.ts";
import { parseCustomId, FEATURES } from "../interactions/customIds.ts";
import * as verificationHandler from "../interactions/handlers/verification.handler.ts";
import * as autoroleHandler from "../interactions/handlers/autorole.handler.ts";
import * as welcomeHandler from "../interactions/handlers/welcome.handler.ts";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction) {
    // ── Autocomplete ───────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        if (command && (command as any).autocomplete) {
          await (command as any).autocomplete(interaction);
        }
      } catch (err) {
        logger.error("Error procesando autocompletado", {
          error: err instanceof Error ? err.message : String(err),
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
      return;
    }

    // ── Buttons ────────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const { feature } = parseCustomId(interaction.customId);
      try {
        switch (feature) {
          case FEATURES.VERIFICATION:
            await verificationHandler.handleButton(interaction);
            break;
          case FEATURES.AUTOROLE:
            await autoroleHandler.handleButton(interaction);
            break;
          default:
            logger.warn("interactionCreate: unrecognized button feature", {
              feature,
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
        }
      } catch (err) {
        logger.error("Error procesando botón", {
          error: err instanceof Error ? err.message : String(err),
          customId: interaction.customId,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
      return;
    }

    // ── Select menus ───────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const { feature } = parseCustomId(interaction.customId);
      try {
        switch (feature) {
          case FEATURES.VERIFICATION:
            await verificationHandler.handleSelect(interaction);
            break;
          case FEATURES.AUTOROLE:
            await autoroleHandler.handleSelect(interaction);
            break;
          default:
            logger.warn("interactionCreate: unrecognized select feature", {
              feature,
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
        }
      } catch (err) {
        logger.error("Error procesando select menu", {
          error: err instanceof Error ? err.message : String(err),
          customId: interaction.customId,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
      return;
    }

    // ── Modals ─────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const { feature } = parseCustomId(interaction.customId);
      try {
        switch (feature) {
          case FEATURES.VERIFICATION:
            await verificationHandler.handleModal(interaction);
            break;
          case FEATURES.WELCOME:
            await welcomeHandler.handleModal(interaction);
            break;
          case FEATURES.AUTOROLE:
            // autorole modals are handled by the session collector in setup.ts;
            // they should not reach here in normal operation.
            logger.warn("interactionCreate: autorole modal reached router (should be handled by collector)", {
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
            break;
          default:
            logger.warn("interactionCreate: unrecognized modal feature", {
              feature,
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
        }
      } catch (err) {
        logger.error("Error procesando modal", {
          error: err instanceof Error ? err.message : String(err),
          customId: interaction.customId,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
      return;
    }

    // ── Slash commands ─────────────────────────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.error(`Command not found: ${interaction.commandName}`, {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      return;
    }

    try {
      logger.debug(`Executing command: ${interaction.commandName}`, {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
      await command.execute(interaction);
      logger.debug(`Command executed successfully: ${interaction.commandName}`, {
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });
    } catch (error) {
      logger.error(`Error executing command: ${interaction.commandName}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      const replyOptions: InteractionReplyOptions = {
        content: "❌ Hubo un error ejecutando este comando.",
        flags: [MessageFlags.Ephemeral],
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyOptions);
        } else {
          await interaction.reply(replyOptions);
        }
      } catch (replyError) {
        logger.error("Failed to send error reply to user", {
          error: replyError instanceof Error ? replyError.message : String(replyError),
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
    }
  },
};
