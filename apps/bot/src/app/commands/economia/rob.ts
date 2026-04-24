import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";
import { EconomyConfigService } from "../../services/economy/EconomyConfigService.js";
import { rateLimitCommand } from "../../../infrastructure/valkey/rate-limit.js";

const successMessages = [
  "lograste robarle a",
  "conseguiste quitarle dinero a",
  "robaste exitosamente a",
  "despojaste a",
  "le quitaste dinero a",
  "asaltaste a",
];

const failMessages = [
  "intentaste robar a",
  "quisiste asaltar a",
  "trataste de robar a",
  "intentaste quitarle dinero a",
  "quisiste despojar a",
  "trataste de asaltar a",
];

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "rob");

    await interaction.deferReply();

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guildId;
    const targetUser = interaction.options.getUser("usuario");

    // Verificar que se use en un servidor
    if (!guildId) {
      await interaction.editReply({
        content: "❌ Este comando solo puede usarse en un servidor.",
      });
      return;
    }

    if (!targetUser) {
      await interaction.editReply({
        content: "❌ No se encontró el usuario especificado.",
      });
      return;
    }

    // No puedes robarte a ti mismo
    if (targetUser.id === userId) {
      await interaction.editReply({
        content: "❌ No puedes robarte a ti mismo. ¡Eso no tiene sentido!",
      });
      return;
    }

    // No puedes robar a bots
    if (targetUser.bot) {
      await interaction.editReply({
        content: "❌ No puedes robar a un bot. ¡Los bots no tienen dinero!",
      });
      return;
    }

    // Check rate limit
    const allowed = await rateLimitCommand(interaction, "rob");
    if (!allowed) return;

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
        content: `🚔 ¡Estás en prisión! No puedes robar hasta <t:${releaseTime}:R>`,
      });
      return;
    }

    // Verificar cooldown
    const cooldown = await EconomyService.checkCooldown(userId, guildId, "rob");
    if (cooldown.onCooldown && cooldown.remainingTime) {
      const hours = Math.floor(cooldown.remainingTime / 3600000);
      const minutes = Math.ceil((cooldown.remainingTime % 3600000) / 60000);

      await interaction.editReply({
        content: `⏰ Necesitas esperar antes de robar de nuevo. Tiempo restante: **${hours}h ${minutes}m**`,
      });
      return;
    }

    // Crear o obtener usuarios
    const robber = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );
    const victim = await EconomyService.getOrCreateUser(
      targetUser.id,
      targetUser.username,
      guildId,
    );

    // Verificar que la víctima tenga dinero en el bolsillo
    if (victim.pocket <= 0) {
      await interaction.editReply({
        content: `❌ **${targetUser.username}** no tiene dinero en su bolsillo. ¡No hay nada que robar!`,
      });
      return;
    }

    // Actualizar cooldown
    await EconomyService.updateCooldown(userId, guildId, "rob");

    // Determinar si el robo tiene éxito (60% de probabilidad)
    const success = Math.random() < 0.6;

    if (success) {
      // ÉXITO: Roba entre 40% y 80% del dinero del bolsillo de la víctima
      const percentage = Math.random() * 0.4 + 0.4; // 0.4 a 0.8
      const stolenAmount = victim.pocket * percentage;

      // Transferir el dinero
      await EconomyService.transfer(
        targetUser.id,
        userId,
        guildId,
        stolenAmount,
        targetUser.username,
        username,
        interaction.guild!,
      );

      // Obtener balances actualizados
      const robberBalance = await EconomyService.getBalance(userId, guildId);
      const victimBalance = await EconomyService.getBalance(
        targetUser.id,
        guildId,
      );

      // Seleccionar mensaje aleatorio
      const message =
        successMessages[Math.floor(Math.random() * successMessages.length)];

      // Crear embed con el resultado
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("💰 ¡Robo Exitoso!")
        .setDescription(
          `🦹 **${interaction.user.username}** ${message} **${targetUser.username}** y robó **$${stolenAmount.toFixed(2)}**!`,
        )
        .addFields(
          {
            name: "💵 Dinero Robado",
            value: `$${stolenAmount.toFixed(2)} (${(percentage * 100).toFixed(0)}% del bolsillo)`,
            inline: false,
          },
          {
            name: `🦹 ${interaction.user.username} (Ladrón)`,
            value: `👛 Bolsillo: $${robberBalance.pocket.toFixed(2)}\n🏦 Banco: $${robberBalance.bank.toFixed(2)}`,
            inline: true,
          },
          {
            name: `😢 ${targetUser.username} (Víctima)`,
            value: `👛 Bolsillo: $${victimBalance.pocket.toFixed(2)}\n🏦 Banco: $${victimBalance.bank.toFixed(2)}`,
            inline: true,
          },
        )
        .setFooter({
          text: "¡Lograste escapar! Podrás robar de nuevo en 2 horas",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`Rob command executed successfully - SUCCESS`, {
        robberId: userId,
        robberName: username,
        victimId: targetUser.id,
        victimName: targetUser.username,
        stolenAmount,
      });
    } else {
      // FALLO: Debe pagar 20% del total de su dinero (bolsillo + banco) a la víctima
      const robberBalance = await EconomyService.getBalance(userId, guildId);
      const penalty = (robberBalance.pocket + robberBalance.bank) * 0.2;

      // Obtener tiempo de prisión de la configuración
      const config = await EconomyConfigService.getOrCreateConfig(guildId);
      const jailTime = config.jailTimeRob;

      // Verificar si tiene suficiente dinero en el bolsillo para pagar la multa
      if (robberBalance.pocket < penalty) {
        // No tiene suficiente en el bolsillo, va a prisión
        const releaseTime = await EconomyService.sendToJail(
          userId,
          guildId,
          jailTime,
        );
        const releaseTimestamp = Math.floor(releaseTime.getTime() / 1000);

        const failMessage =
          failMessages[Math.floor(Math.random() * failMessages.length)];

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("🚔 ¡ATRAPADO!")
          .setDescription(
            `${failMessage} **${targetUser.username}**, pero te atraparon!\n\n` +
              `No tienes suficiente en tu bolsillo para pagar la multa de **$${penalty.toFixed(2)}**.\n` +
              `¡Vas a prisión! Puedes usar \`/bail\` para pagar la multa con tu banco y salir.`,
          )
          .addFields(
            {
              name: "⚖️ Multa a Pagar",
              value: `$${penalty.toFixed(2)}`,
              inline: true,
            },
            {
              name: "👛 Tu Bolsillo",
              value: `$${robberBalance.pocket.toFixed(2)}`,
              inline: true,
            },
            {
              name: "⚖️ Condena",
              value: `${jailTime} minutos en prisión`,
              inline: true,
            },
            {
              name: "🔓 Liberación",
              value: `<t:${releaseTimestamp}:R>`,
              inline: true,
            },
            {
              name: "💡 Tip",
              value: `Usa \`/bail\` para pagar con tu banco ($${robberBalance.bank.toFixed(2)}) y salir antes`,
              inline: false,
            },
          )
          .setFooter({
            text: "¡La próxima vez asegúrate de tener dinero en el bolsillo!",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Rob command executed - FAILED - SENT TO JAIL`, {
          robberId: userId,
          robberName: username,
          victimId: targetUser.id,
          victimName: targetUser.username,
          reason: "Insufficient pocket money to pay penalty",
          penalty,
          pocket: robberBalance.pocket,
        });
      } else {
        // Tiene suficiente en el bolsillo, paga la penalización
        await EconomyService.transfer(
          userId,
          targetUser.id,
          guildId,
          penalty,
          username,
          targetUser.username,
          interaction.guild!,
        );

        // Obtener balances actualizados
        const robberBalanceAfter = await EconomyService.getBalance(
          userId,
          guildId,
        );
        const victimBalance = await EconomyService.getBalance(
          targetUser.id,
          guildId,
        );

        const failMessage =
          failMessages[Math.floor(Math.random() * failMessages.length)];

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("🚔 ¡ATRAPADO!")
          .setDescription(
            `${failMessage} **${targetUser.username}**, pero te atraparon!\n\n` +
              `Tuviste que pagar el 20% de tu dinero total como compensación.`,
          )
          .addFields(
            {
              name: "⚖️ Penalización Pagada",
              value: `$${penalty.toFixed(2)}`,
              inline: false,
            },
            {
              name: `😭 ${interaction.user.username} (Ladrón Fallido)`,
              value: `👛 Bolsillo: $${robberBalanceAfter.pocket.toFixed(2)}\n🏦 Banco: $${robberBalanceAfter.bank.toFixed(2)}`,
              inline: true,
            },
            {
              name: `😊 ${targetUser.username} (Compensado)`,
              value: `👛 Bolsillo: $${victimBalance.pocket.toFixed(2)}\n🏦 Banco: $${victimBalance.bank.toFixed(2)}`,
              inline: true,
            },
          )
          .setFooter({
            text: "¡La próxima vez ten más suerte! Podrás robar de nuevo en 2 horas",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Rob command executed - FAILED - PAID PENALTY`, {
          robberId: userId,
          robberName: username,
          victimId: targetUser.id,
          victimName: targetUser.username,
          penalty,
        });
      }
    }
  } catch (error) {
    logger.error("Error executing rob command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage = "❌ Error al intentar robar. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, flags: [MessageFlags.Ephemeral] });
    }
  }
}
