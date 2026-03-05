import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";
import { EconomyConfigService } from "../../services/economy/EconomyConfigService.js";

// Lista de trabajos posibles con sus descripciones
const jobs = [
  { name: "Programador", emoji: "💻", min: 100, max: 300 },
  { name: "Chef", emoji: "👨‍🍳", min: 80, max: 250 },
  { name: "Conductor de Uber", emoji: "🚗", min: 70, max: 200 },
  { name: "Músico Callejero", emoji: "🎸", min: 50, max: 180 },
  { name: "Barista", emoji: "☕", min: 60, max: 150 },
  { name: "Repartidor", emoji: "📦", min: 90, max: 220 },
  { name: "Diseñador Gráfico", emoji: "🎨", min: 110, max: 280 },
  { name: "Fotógrafo", emoji: "📷", min: 95, max: 240 },
  { name: "Limpiador de Ventanas", emoji: "🧹", min: 65, max: 160 },
  { name: "DJ", emoji: "🎧", min: 120, max: 350 },
  { name: "Jardinero", emoji: "🌱", min: 75, max: 190 },
  { name: "Mecánico", emoji: "🔧", min: 85, max: 230 },
  { name: "Profesor Particular", emoji: "📚", min: 100, max: 270 },
  { name: "Entrenador Personal", emoji: "💪", min: 110, max: 290 },
  { name: "Vendedor", emoji: "🛍️", min: 70, max: 210 },
];

const workMessages = [
  "trabajaste duro como",
  "hiciste un excelente trabajo como",
  "completaste tu turno como",
  "te esforzaste mucho como",
  "diste lo mejor de ti como",
  "tuviste un día productivo como",
];

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "work");

    await interaction.deferReply();

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guildId;

    // Verificar que se use en un servidor
    if (!guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Verificar si el usuario está en prisión
    const inJail = await EconomyService.isInJail(userId, guildId);
    if (inJail) {
      const user = await EconomyService.getOrCreateUser(
        userId,
        username,
        guildId,
      );
      const releaseTime = user.jailReleaseAt
        ? Math.floor(user.jailReleaseAt.getTime() / 1000)
        : 0;

      await interaction.editReply({
        content: `🚔 ¡Estás en prisión! No puedes trabajar hasta <t:${releaseTime}:R>`,
      });
      return;
    }

    // Verificar cooldown
    const cooldown = await EconomyService.checkCooldown(
      userId,
      guildId,
      "work",
    );
    if (cooldown.onCooldown && cooldown.remainingTime) {
      const minutes = Math.ceil(cooldown.remainingTime / 60000);
      const seconds = Math.ceil((cooldown.remainingTime % 60000) / 1000);

      await interaction.editReply({
        content: `⏰ Necesitas descansar. Podrás trabajar de nuevo en **${minutes}m ${seconds}s**`,
      });
      return;
    }

    // Crear o obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );

    // Seleccionar trabajo aleatorio
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    if (!job) {
      await interaction.editReply({
        content: "❌ Error al seleccionar trabajo. Inténtalo de nuevo.",
      });
      return;
    }

    // Obtener configuración del servidor para rangos de ganancia
    const config = await EconomyConfigService.getOrCreateConfig(guildId);
    const minAmount = config.workMinAmount;
    const maxAmount = config.workMaxAmount;

    // Calcular ganancia aleatoria dentro del rango configurado
    const earnings = Math.floor(
      Math.random() * (maxAmount - minAmount + 1) + minAmount,
    );

    // Agregar dinero al bolsillo
    await EconomyService.addPocket(
      userId,
      guildId,
      earnings,
      username,
      interaction.guild!,
    );

    // Actualizar cooldown
    await EconomyService.updateCooldown(userId, guildId, "work");

    // Seleccionar mensaje aleatorio
    const message =
      workMessages[Math.floor(Math.random() * workMessages.length)];

    // Crear embed con el resultado
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("💼 Trabajo Completado")
      .setDescription(
        `${job.emoji} **${interaction.user.username}** ${message} **${job.name}** y ganó **$${earnings.toFixed(2)}**!`,
      )

      .setFooter({ text: `Podrás trabajar de nuevo más tarde` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Work command executed successfully`, {
      userId,
      username,
      job: job.name,
      earnings,
    });
  } catch (error) {
    logger.error("Error executing work command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al trabajar. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
