import { EmbedBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "retirar");

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
        content: `🚔 ¡Estás en prisión! No puedes retirar hasta <t:${releaseTime}:R>`,
      });
      return;
    }

    // Crear o obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );

    // Obtener cantidad a retirar
    let amount = interaction.options.get("cantidad")?.value as number;

    // Obtener banco global
    const globalBank = await EconomyService.getOrCreateGlobalBank(
      userId,
      username,
    );

    // Verificar que tenga dinero en el banco
    if (globalBank.bank <= 0) {
      await interaction.editReply({
        content: "❌ No tienes dinero en tu banco para retirar.",
      });
      return;
    }

    // Si la cantidad es mayor al banco, retirar todo
    if (amount > globalBank.bank) {
      amount = globalBank.bank;
    }

    // Realizar el retiro
    await EconomyService.withdraw(
      userId,
      guildId,
      username,
      amount,
      interaction.guild!,
    );

    // Obtener balance actualizado
    const balance = await EconomyService.getBalance(userId, guildId);

    // Crear embed con el resultado
    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("🏦 Retiro Exitoso")
      .setDescription(
        `**${username}** retiró **$${amount.toFixed(2)}** del banco.`,
      )
      .addFields(
        {
          name: "💵 Retirado",
          value: `$${amount.toFixed(2)}`,
          inline: true,
        },
        {
          name: "👛 Bolsillo",
          value: `$${balance.pocket.toFixed(2)}`,
          inline: true,
        },
        {
          name: "🏦 Banco (Global)",
          value: `$${balance.bank.toFixed(2)}`,
          inline: true,
        },
      )
      .setFooter({
        text: "⚠️ Usa /deposit y /retirar para manejar tu dinero",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Retirar command executed successfully`, {
      userId,
      username,
      amount,
      newPocketBalance: balance.pocket,
    });
  } catch (error) {
    logger.error("Error executing retirar command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      error instanceof Error && error.message.includes("insuficientes")
        ? `❌ ${error.message}`
        : "❌ Error al retirar. Inténtalo de nuevo.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
