import { EmbedBuilder } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";
import type { ChatInputCommandInteraction } from "discord.js";

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "deposit");

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
        content: `🚔 ¡Estás en prisión! No puedes depositar hasta <t:${releaseTime}:R>`,
      });
      return;
    }

    // Crear o obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );

    // Obtener cantidad a depositar
    let amount = interaction.options.get("cantidad")?.value as number;

    // Verificar que tenga dinero en el bolsillo
    if (user.pocket <= 0) {
      await interaction.editReply({
        content: "❌ No tienes dinero en tu bolsillo para depositar.",
      });
      return;
    }

    // Si la cantidad es mayor al bolsillo, depositar todo
    if (amount > user.pocket) {
      amount = user.pocket;
    }

    // Realizar el depósito
    await EconomyService.deposit(
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
      .setColor(0x00ff00)
      .setTitle("🏦 Depósito Exitoso")
      .setDescription(
        `**${username}** depositó **$${amount.toFixed(2)}** en el banco.`,
      )
      .addFields(
        {
          name: "💵 Depositado",
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
        text: "Tu dinero está más seguro en el banco. No puede ser robado.",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Deposit command executed successfully`, {
      userId,
      username,
      amount,
      newBankBalance: balance.bank,
    });
  } catch (error) {
    logger.error("Error executing deposit command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      error instanceof Error && error.message.includes("insuficientes")
        ? `❌ ${error.message}`
        : "❌ Error al depositar. Inténtalo de nuevo.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
