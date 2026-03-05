import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.ts";
import musicService from "../../services/MusicService.ts";
import type { LoopMode } from "../../../types/music.ts";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "loop");

    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const queue = musicService.getQueue(interaction.guildId);

    if (!queue || !queue.connection) {
      await interaction.reply({
        content: "❌ No hay música reproduciéndose.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const mode = interaction.options.getString("mode", true) as LoopMode;

    const success = musicService.setLoop(interaction.guildId, mode);

    if (success) {
      let message: string;
      let icon: string;

      switch (mode) {
        case "none":
          icon = "➡️";
          message = "Repetición desactivada";
          break;
        case "song":
          icon = "🔂";
          message = "Repitiendo la canción actual";
          break;
        case "queue":
          icon = "🔁";
          message = "Repitiendo toda la cola";
          break;
        default:
          icon = "❓";
          message = "Modo desconocido";
      }

      await interaction.reply({
        content: `${icon} ${message}`,
      });

      logger.info("Loop command executed successfully", {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        mode,
      });
    } else {
      await interaction.reply({
        content: "❌ No se pudo cambiar el modo de repetición.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  } catch (error) {
    logger.error("Error executing loop command", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al cambiar el modo de repetición.";
    if (interaction.replied) {
      return;
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
