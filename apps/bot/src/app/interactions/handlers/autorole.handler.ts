/**
 * AutoRole feature handler.
 *
 * Handles two distinct interaction types:
 *
 * 1. `autorole:assign:*` buttons — public role-assignment buttons in guild messages.
 *    Contains the logic moved from interactionCreate.ts lines 68–156.
 *
 * 2. `autorole:select:*` select menus — delegated to the session collector in setup.ts.
 *
 * NOTE: `autorole:config:*` buttons are intentionally NOT handled here.
 * Those are intercepted and handled by the channel collector created inside
 * setup.ts → startCollector(). If they somehow reach this handler (which they
 * should not in normal operation), they are silently ignored.
 */

import { MessageFlags } from "discord.js";
import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import * as AutoRoleRepo from "../../../config/repositories/AutoRoleRepo.ts";
import * as AutoRoleService from "../../services/AutoRoleService.ts";
import { handleSelectMenu as handleAutoRoleSelectMenu } from "../../commands/autorole/setup.ts";
import { parseCustomId } from "../customIds.ts";
import logger from "../../../utils/logger.ts";

/**
 * Handles button interactions in the autorole feature.
 *
 * Only processes `autorole:assign:{roleId}` buttons.
 * Config buttons (`autorole:config:*`) are not handled here — they belong
 * to the session collector in setup.ts.
 */
export async function handleButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const { action, payload: roleId } = parseCustomId(interaction.customId);

  // Only handle public role-assignment buttons
  if (action !== "assign") {
    // Config buttons (add_mapping, edit_mapping, etc.) are handled by the
    // session collector in setup.ts. Nothing to do here.
    return;
  }

  if (!interaction.guild) {
    return;
  }

  if (!roleId) {
    logger.error("autorole.handler: missing roleId in assign button customId", {
      customId: interaction.customId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.reply({
      content: "❌ Botón de rol inválido.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  try {
    // Verify this message has an autorole configuration
    const autoRole = await AutoRoleRepo.getAutoRoleByMessageId(
      interaction.guildId!,
      interaction.message.id,
    );

    if (!autoRole) {
      await interaction.reply({
        content: "❌ Esta configuración de auto-roles ya no existe.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Verify the mapping exists for this button
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

    const member = await interaction.guild.members.fetch(interaction.user.id);

    // Toggle: remove if already has the role, assign otherwise
    const hasRole = member.roles.cache.has(roleId);

    if (hasRole) {
      const result = await AutoRoleService.removeRole(member, roleId);
      if (result.success) {
        await interaction.reply({
          content: "✅ Rol removido exitosamente.",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await interaction.reply({
          content: `❌ ${result.error ?? "Error al remover el rol."}`,
          flags: [MessageFlags.Ephemeral],
        });
      }
    } else {
      const result = await AutoRoleService.assignRole(member, roleId, autoRole);
      if (result.success) {
        await interaction.reply({
          content: "✅ Rol asignado exitosamente.",
          flags: [MessageFlags.Ephemeral],
        });
      } else {
        await interaction.reply({
          content: `❌ ${result.error ?? "Error al asignar el rol."}`,
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  } catch (err) {
    logger.error("autorole.handler: error procesando botón de auto-role", {
      error: err instanceof Error ? err.message : String(err),
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
}

/**
 * Handles string select menu interactions in the autorole feature.
 *
 * Delegates to handleSelectMenu from setup.ts (which handles
 * `autorole:select:edit` and `autorole:select:remove`).
 */
export async function handleSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  await handleAutoRoleSelectMenu(interaction);
}
