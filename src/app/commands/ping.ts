import { SlashCommandBuilder } from "@discordjs/builders";
import type { CommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.ts";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Verifica el estado y latencia del bot");

export async function execute(interaction: CommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "ping");

    await interaction.deferReply();

    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    logger.info("Ping command executed successfully", {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      latency,
      apiLatency,
    });

    await interaction.editReply(
      `📡 Latencia: ${latency}ms\n🌐 API: ${apiLatency}ms\n✅ Estado: En línea`,
    );
  } catch (error) {
    logger.error("Error executing ping command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al verificar el estado del bot.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
