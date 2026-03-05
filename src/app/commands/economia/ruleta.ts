import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import type {
  CommandInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";
import { RouletteService } from "../../services/economy/RouletteService.js";
import { EconomyConfigService } from "../../services/economy/EconomyConfigService.js";

// Mapa para almacenar los juegos activos por canal
const activeGames = new Map<
  string,
  { gameId: number; timeout: NodeJS.Timeout }
>();

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "ruleta");

    await interaction.deferReply();

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;

    // Verificar que se use en un servidor
    if (!guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    // Verificar si hay un canal dedicado configurado
    const config = await EconomyConfigService.getOrCreateConfig(guildId);
    if (config.rouletteChannelId && config.rouletteChannelId !== channelId) {
      await interaction.editReply({
        content: `❌ Este comando solo puede usarse en <#${config.rouletteChannelId}>`,
      });
      return;
    }

    // Obtener parámetros
    const betType = interaction.options.get("tipo")?.value as
      | "color"
      | "number";
    const betValue = (
      interaction.options.get("apuesta")?.value as string
    ).toLowerCase();
    const amount = interaction.options.get("cantidad")?.value as number;

    // Validar que el usuario no esté en prisión
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
        content: `🚔 ¡Estás en prisión! No puedes jugar hasta <t:${releaseTime}:R>`,
      });
      return;
    }

    // Validar la apuesta
    if (!RouletteService.validateBet(betType, betValue)) {
      await interaction.editReply({
        content: `❌ Apuesta inválida. Para color usa: red, black o green. Para número usa: 0-36`,
      });
      return;
    }

    // Crear o obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );

    // Verificar fondos
    if (user.pocket < amount) {
      await interaction.editReply({
        content: `❌ No tienes suficiente dinero en tu bolsillo. Tienes: $${user.pocket.toFixed(2)}`,
      });
      return;
    }

    // Verificar si hay un juego activo en el canal
    let game = await RouletteService.getActiveGame(channelId);
    let isNewGame = false;

    if (!game) {
      // Crear nuevo juego
      game = await RouletteService.createGame(
        interaction.guildId || "DM",
        channelId,
        interaction.id,
      );
      isNewGame = true;
    }

    // En este punto game no puede ser null porque o existe o se crea
    if (!game) {
      await interaction.editReply({
        content: "❌ Error al crear el juego. Inténtalo de nuevo.",
      });
      return;
    }

    const gameId = game.id;

    // Realizar la apuesta
    await RouletteService.placeBet(
      gameId,
      userId,
      guildId,
      amount,
      betType,
      betValue,
      username,
      interaction.guild!,
    );

    // Crear embed con información del juego
    const bets = await RouletteService.getGameBets(gameId);
    const totalBets = bets.reduce((sum, bet) => sum + bet.amount, 0);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🎰 RULETA - Apuestas Abiertas")
      .setDescription(
        `El juego comenzará en **30 segundos**.\n¡Más jugadores pueden unirse!`,
      )
      .addFields(
        {
          name: "💰 Apuestas Totales",
          value: `$${totalBets.toFixed(2)}`,
          inline: true,
        },
        {
          name: "👥 Jugadores",
          value: `${bets.length}`,
          inline: true,
        },
      )
      .setFooter({ text: "Usa /ruleta para unirte a la partida" });

    // Agregar información de las apuestas
    let betsInfo = "";
    for (const bet of bets) {
      const betDisplay =
        bet.betType === "color"
          ? bet.betValue === "red"
            ? "🔴 Rojo"
            : bet.betValue === "black"
              ? "⚫ Negro"
              : "🟢 Verde"
          : `#️⃣ ${bet.betValue}`;
      betsInfo += `<@${bet.userId}>: ${betDisplay} - $${bet.amount}\n`;
    }
    embed.addFields({
      name: "📋 Apuestas",
      value: betsInfo || "No hay apuestas aún",
    });

    if (isNewGame) {
      await interaction.editReply({
        content: `✅ <@${userId}> ha iniciado una nueva partida de ruleta!`,
        embeds: [embed],
      });

      // Programar el inicio del juego después de 30 segundos
      const timeout = setTimeout(async () => {
        await spinRoulette(gameId, interaction);
        activeGames.delete(channelId);
      }, 30000);

      activeGames.set(channelId, { gameId, timeout });
    } else {
      await interaction.editReply({
        content: `✅ <@${userId}> se ha unido a la partida!`,
        embeds: [embed],
      });
    }

    logger.info(`Ruleta bet placed by ${username}`, {
      userId,
      gameId,
      betType,
      betValue,
      amount,
    });
  } catch (error) {
    logger.error("Error executing ruleta command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al procesar tu apuesta. Verifica que tengas fondos suficientes.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}

async function spinRoulette(gameId: number, interaction: CommandInteraction) {
  try {
    const channelId = interaction.channelId;
    const channel = await interaction.client.channels.fetch(channelId);

    if (!channel?.isTextBased() || !("send" in channel)) {
      logger.error("Channel not found or not text-based");
      return;
    }

    // Obtener apuestas antes de girar
    const bets = await RouletteService.getGameBets(gameId);

    if (bets.length === 0) {
      await channel.send({
        content:
          "❌ No hay apuestas en este juego. El juego ha sido cancelado.",
      });
      await RouletteService.cancelGame(gameId, interaction.guild!);
      return;
    }

    // Mensaje de "girando"
    const spinningEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle("🎰 GIRANDO LA RULETA...")
      .setDescription("🔄 La bola está girando...");

    await channel.send({ embeds: [spinningEmbed] });

    // Esperar 3 segundos para crear suspenso
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Girar la ruleta
    const game = await RouletteService.spin(gameId);

    // Procesar resultados
    const results = await RouletteService.processResults(
      gameId,
      interaction.guild!,
    );

    // Crear embed con resultados
    const colorEmoji =
      results.winningColor === "red"
        ? "🔴"
        : results.winningColor === "black"
          ? "⚫"
          : "🟢";

    const resultEmbed = new EmbedBuilder()
      .setColor(
        results.winningColor === "red"
          ? 0xff0000
          : results.winningColor === "black"
            ? 0x000000
            : 0x00ff00,
      )
      .setTitle("🎰 RESULTADO DE LA RULETA")
      .setDescription(
        `**${colorEmoji} ${results.winningNumber} ${results.winningColor.toUpperCase()}**`,
      )
      .setTimestamp();

    // Agregar resultados de cada jugador
    let winnersInfo = "";
    let losersInfo = "";

    for (const result of results.results) {
      const betDisplay =
        result.betType === "color"
          ? result.betValue === "red"
            ? "🔴 Rojo"
            : result.betValue === "black"
              ? "⚫ Negro"
              : "🟢 Verde"
          : `#️⃣ ${result.betValue}`;

      if (result.won) {
        winnersInfo += `<@${result.userId}>: ${betDisplay} - Ganó **$${result.winAmount?.toFixed(2)}** (apostó $${result.amount})\n`;
      } else {
        losersInfo += `<@${result.userId}>: ${betDisplay} - Perdió $${result.amount}\n`;
      }
    }

    if (winnersInfo) {
      resultEmbed.addFields({ name: "🎉 Ganadores", value: winnersInfo });
    }
    if (losersInfo) {
      resultEmbed.addFields({ name: "😢 Perdedores", value: losersInfo });
    }

    resultEmbed.setFooter({
      text: "¡Gracias por jugar! Usa /ruleta para jugar de nuevo",
    });

    await channel.send({ embeds: [resultEmbed] });

    logger.info(`Ruleta game ${gameId} completed`, {
      winningNumber: results.winningNumber,
      winningColor: results.winningColor,
      totalResults: results.results.length,
    });
  } catch (error) {
    logger.error("Error spinning ruleta", {
      error: error instanceof Error ? error.message : String(error),
      gameId,
    });
  }
}
