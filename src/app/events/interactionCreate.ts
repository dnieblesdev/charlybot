import { Events } from "discord.js";
import type { Interaction } from "discord.js";
import logger, { logError } from "../../utils/logger.ts";
import {
  setWelcomeChannel,
  setWelcomeMessage,
} from "../../config/repositories/GuildConfigRepo.ts";
import {
  handleVerificationStart,
  handleVerificationModalSubmit,
  handleVerificationApprove,
  handleVerificationReject,
  handleClassSelect,
  handleSubclassSelect,
} from "../services/VerificationHandler.ts";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction) {
    // Manejar botones de verificación
    if (interaction.isButton()) {
      try {
        if (interaction.customId === "verification_start") {
          await handleVerificationStart(interaction);
          return;
        }

        if (interaction.customId.startsWith("verification_approve_")) {
          await handleVerificationApprove(interaction);
          return;
        }

        if (interaction.customId.startsWith("verification_reject_")) {
          await handleVerificationReject(interaction);
          return;
        }
      } catch (buttonErr) {
        logger.error("Error procesando botón", {
          error:
            buttonErr instanceof Error ? buttonErr.message : String(buttonErr),
          customId: interaction.customId,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
    }

    // Manejar select menus (menús desplegables)
    if (interaction.isStringSelectMenu()) {
      try {
        if (interaction.customId.startsWith("class_select_")) {
          await handleClassSelect(interaction);
          return;
        }

        if (interaction.customId.startsWith("subclass_select_")) {
          await handleSubclassSelect(interaction);
          return;
        }
      } catch (selectErr) {
        logger.error("Error procesando select menu", {
          error:
            selectErr instanceof Error ? selectErr.message : String(selectErr),
          customId: interaction.customId,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
    }

    // Manejar autocompletado
    if (interaction.isAutocomplete()) {
      try {
        const command = interaction.client.commands.get(
          interaction.commandName,
        );
        if (command && (command as any).autocomplete) {
          await (command as any).autocomplete(interaction);
          return;
        }
      } catch (autocompleteErr) {
        logger.error("Error procesando autocompletado", {
          error:
            autocompleteErr instanceof Error
              ? autocompleteErr.message
              : String(autocompleteErr),
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
    }

    // Manejar modales
    try {
      if (interaction.isModalSubmit()) {
        // Modal de verificación
        if (interaction.customId.startsWith("verification_modal_")) {
          await handleVerificationModalSubmit(interaction);
          return;
        }

        // Modal de welcome
        if (
          interaction.customId &&
          interaction.customId.startsWith("setWelcomeModal:")
        ) {
          const parts = interaction.customId.split(":");
          const channelId = parts[1];

          if (!interaction.guild) {
            await interaction.reply({
              content: "❌ Este modal solo puede ser procesado en servidores.",
              ephemeral: true,
            });
            return;
          }

          try {
            const mensaje = interaction.fields.getTextInputValue("mensaje");

            await setWelcomeMessage(interaction.guild.id, mensaje);
            await setWelcomeChannel(interaction.guild.id, channelId!);

            logger.info("welcome configurado (vía modal)", {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
              channelId,
              message: mensaje,
            });

            await interaction.reply({
              content: `✅ Mensaje de bienvenida configurado para <#${channelId}>.\nMensaje: ${mensaje}`,
              ephemeral: true,
            });
          } catch (err) {
            logger.error("Error procesando modal set-welcome", {
              error: err instanceof Error ? err.message : String(err),
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
            if (!interaction.replied) {
              await interaction.reply({
                content: "❌ Error guardando la configuración de bienvenida.",
                ephemeral: true,
              });
            }
          }

          // Ya procesamos el modal, salimos
          return;
        }
      }
    } catch (modalErr) {
      logger.error("Error general procesando modales", {
        error: modalErr instanceof Error ? modalErr.message : String(modalErr),
      });
      // seguimos para manejar otros tipos de interacción si aplica
    }

    // El resto del flujo (comandos slash)
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
      logger.debug(
        `Command executed successfully: ${interaction.commandName}`,
        {
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        },
      );
    } catch (error) {
      logger.error(`Error executing command: ${interaction.commandName}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        commandName: interaction.commandName,
        userId: interaction.user.id,
        guildId: interaction.guildId,
      });

      const replyOptions = {
        content: "❌ Hubo un error ejecutando este comando.",
        ephemeral: true,
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyOptions);
        } else {
          await interaction.reply(replyOptions);
        }
      } catch (replyError) {
        logger.error("Failed to send error reply to user", {
          error:
            replyError instanceof Error
              ? replyError.message
              : String(replyError),
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        });
      }
    }
  },
};
