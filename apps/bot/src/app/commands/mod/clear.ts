import type { ChatInputCommandInteraction, Collection, Message } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

import * as ModCaseRepository from "../../../config/repositories/modCaseRepository.js";
import { logModAction } from "../../services/ModLogService.js";
import logger from "../../../utils/logger.js";

export default async function clear(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guildId || !interaction.channel || !("messages" in interaction.channel)) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un canal de texto.",
      });
      return;
    }

    // Permission check
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.editReply({
        content: "❌ Necesitás el permiso **Gestionar mensajes** para usar este comando.",
      });
      return;
    }

    const cantidad = interaction.options.getInteger("cantidad", true);
    const targetUser = interaction.options.getUser("usuario");

    const channel = interaction.channel;
    const messages = await channel.messages.fetch({ limit: cantidad });

    let filteredMessages: Collection<string, Message>;
    if (targetUser) {
      filteredMessages = messages.filter((msg) => msg.author?.id === targetUser.id);
    } else {
      filteredMessages = messages;
    }

    if (filteredMessages.size === 0) {
      await interaction.editReply({
        content: "⚠️ No se encontraron mensajes para eliminar.",
      });
      return;
    }

    const deleted = await (channel.messages as unknown as { bulkDelete: (msgs: Collection<string, Message>, filter?: boolean) => Promise<Collection<string, Message>> }).bulkDelete(filteredMessages, true);

    if (deleted.size === 0) {
      await interaction.editReply({
        content: "⚠️ No se pudieron eliminar mensajes (posiblemente mayores a 14 días).",
      });
      return;
    }

    // Create ModCase
    const modCase = await ModCaseRepository.create({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      moderatorId: interaction.user.id,
      type: "clear",
      reason: targetUser ? `Limpieza de mensajes de ${targetUser.username}` : "Limpieza de mensajes",
      messageCount: deleted.size,
    });

    // Log action
    const modTag = interaction.user.username;
    await logModAction(interaction.client, interaction.guildId, modCase, modTag, targetUser?.username ?? "N/A");

    const userNote = targetUser ? ` de @${targetUser.username}` : "";
    await interaction.editReply({
      content: `✅ ${deleted.size} mensajes eliminados${userNote}.`,
    });
  } catch (error) {
    logger.error("Error executing /mod clear", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    await interaction.editReply({
      content: "❌ Error al eliminar mensajes. Inténtalo de nuevo.",
    });
  }
}
