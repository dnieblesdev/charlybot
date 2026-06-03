import { Events, MessageFlags } from "discord.js";
import type { Interaction, InteractionReplyOptions } from "discord.js";
import logger, { createChildLogger } from "../../utils/logger.ts";
import { parseCustomId, FEATURES } from "../interactions/customIds.ts";
import * as verificationHandler from "../interactions/handlers/verification.handler.ts";
import * as autoroleHandler from "../interactions/handlers/autorole.handler.ts";
import { handleModalSubmit as handleAutoroleModal } from "../commands/autorole/setup.ts";
import * as welcomeHandler from "../interactions/handlers/welcome.handler.ts";
import {
  isDuplicateInteraction,
  clearInteractionId,
} from "../../infrastructure/valkey/idempotency";
import {
  commandDuration,
  commandTotal,
} from "../../infrastructure/monitoring/health.ts";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction) {
    // ── Autocomplete ───────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      try {
        const command = interaction.client.commands.get(
          interaction.commandName
        );
        if (command && (command as any).autocomplete) {
          await (command as any).autocomplete(interaction);
        }
      } catch (err) {
        logger.error(
          {
            error: err instanceof Error ? err.message : String(err),
            commandName: interaction.commandName,
            userId: interaction.user.id,
            guildId: interaction.guildId,
          },
          "Error procesando autocompletado"
        );
      }
      return;
    }

    // ── Idempotency guard ──────────────────────────────────────────────────────
    // Protect all non-autocomplete interactions from Discord retries
    if (!interaction.isAutocomplete()) {
      const isDuplicate = await isDuplicateInteraction(interaction.id);
      if (isDuplicate) {
        logger.warn(
          {
            interactionId: interaction.id,
            type: interaction.isChatInputCommand()
              ? "command"
              : interaction.isButton()
              ? "button"
              : interaction.isModalSubmit()
              ? "modal"
              : interaction.isStringSelectMenu()
              ? "select"
              : "unknown",
            commandName: interaction.isChatInputCommand()
              ? interaction.commandName
              : undefined,
            userId: interaction.user?.id,
            guildId: interaction.guildId,
          },
          "Blocked duplicate interaction"
        );

        // Try to inform the user if possible
        try {
          if (!interaction.replied && !interaction.deferred) {
            if (interaction.isRepliable()) {
              await interaction.reply({
                content: "⚠️ Esta interacción ya fue procesada.",
                flags: [MessageFlags.Ephemeral],
              });
            }
          }
        } catch {
          // Silently ignore — interaction may already be acknowledged
        }
        return;
      }
    }

    // ── All non-autocomplete interactions ─────────────────────────────────────
    // Wrap everything in a single try/finally to ensure idempotency cleanup
    // for ALL interaction types (buttons, modals, selects, slash commands).
    // Previously clearInteractionId was only in the slash command's finally block,
    // causing buttons/modals/selects to leak idempotency records on early return.
    try {
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
              logger.warn(
                {
                  feature,
                  customId: interaction.customId,
                  userId: interaction.user.id,
                  guildId: interaction.guildId,
                },
                "interactionCreate: unrecognized button feature"
              );
          }
        } catch (err) {
          logger.error(
            {
              error: err instanceof Error ? err.message : String(err),
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            },
            "Error procesando botón"
          );
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
              logger.warn(
                {
                  feature,
                  customId: interaction.customId,
                  userId: interaction.user.id,
                  guildId: interaction.guildId,
                },
                "interactionCreate: unrecognized select feature"
              );
          }
        } catch (err) {
          logger.error(
            {
              error: err instanceof Error ? err.message : String(err),
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            },
            "Error procesando select menu"
          );
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
              // Autorole modals are handled by setup.ts handleModalSubmit
              await handleAutoroleModal(interaction);
              break;
            default:
              logger.warn(
                {
                  feature,
                  customId: interaction.customId,
                  userId: interaction.user.id,
                  guildId: interaction.guildId,
                },
                "interactionCreate: unrecognized modal feature"
              );
          }
        } catch (err) {
          logger.error(
            {
              error: err instanceof Error ? err.message : String(err),
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            },
            "Error procesando modal"
          );
        }
        return;
      }

      // ── Slash commands ─────────────────────────────────────────────────────────
      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        logger.error(
          {
            commandName: interaction.commandName,
            userId: interaction.user.id,
            guildId: interaction.guildId,
          },
          `Command not found: ${interaction.commandName}`
        );
        return;
      }

      // Child logger with correlation context — all logs during command execution carry user/guild/correlation info
      const childLogger = createChildLogger(logger, {
        correlationId: interaction.id,
        userId: interaction.user.id,
        guildId: interaction.guildId ?? "dm",
        commandName: interaction.commandName,
      });

      try {
        const tCommand = Date.now();
        const msSinceCreation = tCommand - interaction.createdTimestamp;
        childLogger.info(
          {
            msSinceCreation,
            deferred: interaction.deferred,
            replied: interaction.replied,
          },
          `Command started: ${interaction.commandName}`
        );
        const end = commandDuration.startTimer({
          command: interaction.commandName,
        });
        try {
          await command.execute(interaction);
          commandTotal.inc({
            command: interaction.commandName,
            status: "success",
          });
        } catch (error) {
          commandTotal.inc({
            command: interaction.commandName,
            status: "error",
          });
          throw error;
        } finally {
          end();
        }
        childLogger.debug(
          `Command executed successfully: ${interaction.commandName}`
        );
      } catch (error) {
        childLogger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          `Error executing command: ${interaction.commandName}`
        );

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
          // "Unknown interaction" means the token is dead — just log, don't rethrow
          const isUnknownInteraction =
            replyError instanceof Error &&
            replyError.message === "Unknown interaction";

          logger.error(
            {
              error:
                replyError instanceof Error
                  ? replyError.message
                  : String(replyError),
              commandName: interaction.commandName,
              userId: interaction.user.id,
              guildId: interaction.guildId,
              interactionExpired: isUnknownInteraction,
            },
            "Failed to send error reply to user"
          );
        }
      }
    } finally {
      // Always clear idempotency guard for ALL non-autocomplete interaction types
      clearInteractionId(interaction.id);
    }
  },
};
