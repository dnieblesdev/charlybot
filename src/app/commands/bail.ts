import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.js";
import { EconomyService } from "../services/economy/EconomyService.js";
import { prisma } from "../../infrastructure/storage/prismaClient.js";

export const data = new SlashCommandBuilder()
  .setName("bail")
  .setDescription("Paga tu fianza con dinero del banco para salir de prisión");

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "bail");

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

    // Obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );

    // Verificar si está en prisión
    if (!user.inJail || !user.jailReleaseAt) {
      await interaction.editReply({
        content: "❌ No estás en prisión. ¡Eres libre!",
      });
      return;
    }

    // Obtener balance
    const balance = await EconomyService.getBalance(userId, guildId);

    // Calcular la fianza (20% del total)
    const bailAmount = (balance.pocket + balance.bank) * 0.2;

    // Verificar si tiene suficiente dinero en el banco
    if (balance.bank < bailAmount) {
      const releaseTime = Math.floor(user.jailReleaseAt.getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🚔 Fondos Insuficientes")
        .setDescription(
          `No tienes suficiente dinero en tu banco para pagar la fianza.`,
        )
        .addFields(
          {
            name: "⚖️ Fianza Requerida",
            value: `$${bailAmount.toFixed(2)}`,
            inline: true,
          },
          {
            name: "🏦 Tu Banco",
            value: `$${balance.bank.toFixed(2)}`,
            inline: true,
          },
          {
            name: "⏰ Tiempo Restante",
            value: `<t:${releaseTime}:R>`,
            inline: false,
          },
        )
        .setFooter({
          text: "Necesitas más dinero en tu banco o esperar a ser liberado",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Pagar la fianza desde el banco (el dinero se pierde como multa)
    await prisma.globalBank.update({
      where: { userId },
      data: {
        bank: { decrement: bailAmount },
      },
    });

    // Liberar al usuario
    await prisma.userEconomy.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        inJail: false,
        jailReleaseAt: null,
      },
    });

    // Obtener balance actualizado
    const newBalance = await EconomyService.getBalance(userId, guildId);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("🔓 ¡Libre!")
      .setDescription(
        `Has pagado tu fianza de **$${bailAmount.toFixed(2)}** y saliste de prisión.`,
      )
      .addFields(
        {
          name: "💰 Fianza Pagada",
          value: `$${bailAmount.toFixed(2)}`,
          inline: true,
        },
        {
          name: "🏦 Banco Restante",
          value: `$${newBalance.bank.toFixed(2)}`,
          inline: true,
        },
        {
          name: "👛 Bolsillo",
          value: `$${newBalance.pocket.toFixed(2)}`,
          inline: true,
        },
      )
      .setFooter({ text: "¡Mantente fuera de problemas!" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`User ${username} paid bail and got out of jail`, {
      userId,
      guildId,
      bailAmount,
    });
  } catch (error) {
    logger.error("Error executing bail command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al procesar el pago de fianza.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
