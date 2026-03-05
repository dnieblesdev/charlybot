import { Events, MessageFlags } from "discord.js";
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
import * as AutoRoleRepo from "../../config/repositories/AutoRoleRepo.ts";
import * as AutoRoleService from "../services/AutoRoleService.ts";
import {
  handleModalSubmit as handleAutoRoleModalSubmit,
  handleSelectMenu as handleAutoRoleSelectMenu,
} from "../commands/autorole/setup.ts";

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

        // Manejar botones de auto-roles (solo botones de asignación en mensajes públicos)
        if (interaction.customId.startsWith("autorole_")) {
          // Los botones de configuración (add_mapping, edit_mapping, etc.) se manejan
          // automáticamente por el collector en setup.ts, así que solo procesamos
          // los botones de asignación de roles

          // Si es un botón de configuración, ignorarlo aquí
          if (
            interaction.customId === "autorole_add_mapping" ||
            interaction.customId === "autorole_edit_mapping" ||
            interaction.customId === "autorole_remove_mapping" ||
            interaction.customId === "autorole_toggle_mode" ||
            interaction.customId === "autorole_customize_embed" ||
            interaction.customId === "autorole_finish" ||
            interaction.customId === "autorole_cancel" ||
            interaction.customId === "autorole_confirm_remove" ||
            interaction.customId === "autorole_cancel_remove"
          ) {
            // Estos ya están siendo manejados por el collector
            return;
          }

          // Botones de asignación de roles en mensajes públicos (autorole_ROLEID)
          try {
            if (!interaction.guild) return;

            const roleId = interaction.customId.replace("autorole_", "");

            // Verificar si este mensaje tiene configuración de auto-roles
            const autoRole = await AutoRoleRepo.getAutoRoleByMessageId(
              interaction.message.id,
            );

            if (!autoRole) {
              await interaction.reply({
                content: "❌ Esta configuración de auto-roles ya no existe.",
                flags: [MessageFlags.Ephemeral],
              });
              return;
            }

            // Verificar si el mapping existe
            const mapping = autoRole.mappings.find(
              (m) => m.roleId === roleId && m.type === "button",
            );

            if (!mapping) {
              await interaction.reply({
                content: "❌ Este botón ya no está configurado.",
                flags: [MessageFlags.Ephemeral],
              });
              return;
            }

            const member = await interaction.guild.members.fetch(
              interaction.user.id,
            );

            // Verificar si el usuario ya tiene el rol
            const hasRole = member.roles.cache.has(roleId);

            if (hasRole) {
              // Quitar el rol
              const result = await AutoRoleService.removeRole(member, roleId);
              if (result.success) {
                await interaction.reply({
                  content: `✅ Rol removido exitosamente.`,
                  flags: [MessageFlags.Ephemeral],
                });
              } else {
                await interaction.reply({
                  content: `❌ ${result.error || "Error al remover el rol."}`,
                  flags: [MessageFlags.Ephemeral],
                });
              }
            } else {
              // Asignar el rol
              const result = await AutoRoleService.assignRole(
                member,
                roleId,
                autoRole,
              );
              if (result.success) {
                await interaction.reply({
                  content: `✅ Rol asignado exitosamente.`,
                  flags: [MessageFlags.Ephemeral],
                });
              } else {
                await interaction.reply({
                  content: `❌ ${result.error || "Error al asignar el rol."}`,
                  flags: [MessageFlags.Ephemeral],
                });
              }
            }
          } catch (autoRoleErr) {
            logger.error("Error procesando botón de auto-role", {
              error:
                autoRoleErr instanceof Error
                  ? autoRoleErr.message
                  : String(autoRoleErr),
              customId: interaction.customId,
              userId: interaction.user.id,
              guildId: interaction.guildId,
            });
            if (!interaction.replied) {
              await interaction.reply({
                content: "❌ Error al procesar el rol.",
                flags: [MessageFlags.Ephemeral],
              });
            }
          }
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

        // Manejar select menus de auto-roles
        if (
          interaction.customId === "autorole_select_edit" ||
          interaction.customId === "autorole_select_remove"
        ) {
          await handleAutoRoleSelectMenu(interaction);
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

        // Modales de auto-roles
        if (
          interaction.customId === "autorole_initial_modal" ||
          interaction.customId === "autorole_add_mapping_modal" ||
          interaction.customId.startsWith("autorole_customize_modal_")
        ) {
          await handleAutoRoleModalSubmit(interaction);
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
              flags: [MessageFlags.Ephemeral],
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
              flags: [MessageFlags.Ephemeral],
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
                flags: [MessageFlags.Ephemeral],
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
