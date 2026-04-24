import { EmbedBuilder, MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../../utils/logger.js";
import { EconomyService } from "../../services/economy/EconomyService.js";
import { EconomyConfigService } from "../../services/economy/EconomyConfigService.js";
import { rateLimitCommand } from "../../../infrastructure/valkey/rate-limit.js";

// Lista de crímenes posibles
const crimes = [
  { name: "Robar una tienda", emoji: "🏪", successRate: 0.6 },
  { name: "Hackear un cajero automático", emoji: "💻", successRate: 0.55 },
  { name: "Vender artículos robados", emoji: "📦", successRate: 0.65 },
  { name: "Falsificar documentos", emoji: "📄", successRate: 0.5 },
  { name: "Robar un auto", emoji: "🚗", successRate: 0.45 },
  { name: "Asaltar un banco", emoji: "🏦", successRate: 0.4 },
  { name: "Contrabandear mercancía", emoji: "📦", successRate: 0.58 },
  { name: "Extorsionar a un comerciante", emoji: "💰", successRate: 0.52 },
  { name: "Robar joyas", emoji: "💎", successRate: 0.48 },
  { name: "Fraude en línea", emoji: "💳", successRate: 0.62 },
];

const successMessages = [
  "lograste completar tu crimen:",
  "conseguiste salirte con la tuya en:",
  "ejecutaste perfectamente:",
  "nadie te vio cometer:",
  "fue un éxito rotundo:",
  "realizaste sin problemas:",
];

const failMessages = [
  "¡La policía te atrapó intentando:",
  "¡Fuiste arrestado por:",
  "¡Te pillaron en el acto de:",
  "¡Las autoridades te capturaron:",
  "¡La policía intervino mientras:",
  "¡Te detuvieron cuando:",
];

export async function execute(interaction: ChatInputCommandInteraction) {
  let replied = false;
  
  try {
    logCommand(interaction.user.id, interaction.guildId || "DM", "crime");

    await interaction.deferReply();
    replied = true;

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

    // Check rate limit
    const allowed = await rateLimitCommand(interaction, "crime");
    if (!allowed) return;

    // Verificar si el usuario está en prisión
    const inJail = await EconomyService.isInJail(userId, guildId);
    if (inJail) {
      const user = await EconomyService.getOrCreateUser(
        userId,
        username,
        guildId,
      );
      // Handle both Date object and ISO string from API
      const jailDate = user.jailReleaseAt 
        ? (user.jailReleaseAt instanceof Date ? user.jailReleaseAt : new Date(user.jailReleaseAt))
        : null;
      const releaseTime = jailDate
        ? Math.floor(jailDate.getTime() / 1000)
        : 0;

      await interaction.editReply({
        content: `🚔 ¡Ya estás en prisión! Serás liberado <t:${releaseTime}:R>`,
      });
      return;
    }

    // Verificar cooldown
    const cooldown = await EconomyService.checkCooldown(
      userId,
      guildId,
      "crime",
    );
    if (cooldown.onCooldown && cooldown.remainingTime) {
      const minutes = Math.ceil(cooldown.remainingTime / 60000);
      const seconds = Math.ceil((cooldown.remainingTime % 60000) / 1000);

      await interaction.editReply({
        content: `⏰ La policía te está vigilando. Podrás cometer otro crimen en **${minutes}m ${seconds}s**`,
      });
      return;
    }

    // Crear o obtener usuario
    const user = await EconomyService.getOrCreateUser(
      userId,
      username,
      guildId,
    );

    // Seleccionar crimen aleatorio
    const crime = crimes[Math.floor(Math.random() * crimes.length)];

    // Determinar si tiene éxito
    const success = Math.random() < crime!.successRate;

    // Actualizar cooldown
    await EconomyService.updateCooldown(userId, guildId, "crime");

    if (success) {
      // ÉXITO: Obtener configuración del servidor
      const config = await EconomyConfigService.getOrCreateConfig(guildId);
      const multiplier = config.crimeMultiplier;
      const minWork = config.workMinAmount;
      const maxWork = config.workMaxAmount;

      const baseEarnings = Math.floor(
        Math.random() * (maxWork - minWork + 1) + minWork,
      );
      const earnings = baseEarnings * multiplier;

      // Agregar dinero al bolsillo
      await EconomyService.addPocket(
        userId,
        guildId,
        earnings,
        username,
        interaction.guild!,
      );

      // Obtener balance actualizado
      const balance = await EconomyService.getBalance(userId, guildId);

      // Seleccionar mensaje aleatorio
      const message =
        successMessages[Math.floor(Math.random() * successMessages.length)];

      // Crear embed con el resultado
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("🎭 Crimen Exitoso")
        .setDescription(
          `${crime!.emoji} **${interaction.user.username}** ${message} **${crime!.name}** y ganó **$${earnings.toFixed(2)}**!`,
        )
        .addFields(
          {
            name: "💰 Ganancia",
            value: `$${earnings.toFixed(2)}`,
            inline: true,
          },
          {
            name: "👛 Bolsillo",
            value: `$${balance.pocket.toFixed(2)}`,
            inline: true,
          },
          {
            name: "🏦 Banco",
            value: `$${balance.bank.toFixed(2)}`,
            inline: true,
          },
        )
        .setFooter({
          text: "¡Lograste escapar! Podrás cometer otro crimen en 1 hora",
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info(`Crime command executed successfully - SUCCESS`, {
        userId,
        username,
        crime: crime!.name,
        earnings,
        newBalance: balance.pocket,
      });
    } else {
      // FALLO: Pierde la mitad de su dinero en el bolsillo (solo del servidor actual)
      const balance = await EconomyService.getBalance(userId, guildId);
      const fine = user.pocket / 2;

      // Obtener tiempo de prisión de la configuración
      const config = await EconomyConfigService.getOrCreateConfig(guildId);
      const jailTime = config.jailTimeWork;

      if (user.pocket === 0 || fine < 1) {
        // No tiene dinero, va directo a prisión
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
          .setTitle("🚔 ¡ARRESTADO!")
          .setDescription(
            `${crime!.emoji} ${failMessage} **${crime!.name}**!\n\n` +
              `No tienes dinero para pagar la multa, así que vas directo a prisión.`,
          )
          .addFields(
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
          )
          .setFooter({
            text: "No podrás usar comandos hasta que salgas de prisión",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Crime command executed - FAILED - SENT TO JAIL`, {
          userId,
          username,
          crime: crime!.name,
          reason: "No money to pay fine",
        });
      } else {
        // Tiene dinero en el bolsillo, paga la multa
        await EconomyService.subtractPocket(
          userId,
          guildId,
          fine,
          username,
          interaction.guild!,
        );

        // Obtener balance actualizado
        const balance = await EconomyService.getBalance(userId, guildId);

        const failMessage =
          failMessages[Math.floor(Math.random() * failMessages.length)];

        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("🚔 ¡ARRESTADO!")
          .setDescription(
            `${crime!.emoji} ${failMessage} **${crime!.name}**!\n\n` +
              `Tuviste que pagar una multa del 50% de tu dinero en el bolsillo.`,
          )
          .addFields(
            {
              name: "⚖️ Multa Pagada",
              value: `$${fine.toFixed(2)}`,
              inline: true,
            },
            {
              name: "👛 Bolsillo Restante",
              value: `$${balance.pocket.toFixed(2)}`,
              inline: true,
            },
            {
              name: "🏦 Banco Restante",
              value: `$${balance.bank.toFixed(2)}`,
              inline: true,
            },
          )
          .setFooter({
            text: "¡Tuviste suerte de no ir a prisión! Podrás intentar otro crimen en 1 hora",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`Crime command executed - FAILED - PAID FINE`, {
          userId,
          username,
          crime: crime!.name,
          fine,
          remainingBalance: balance.total,
        });
      }
    }
  } catch (error) {
    logger.error("Error executing crime command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    if (replied) {
      try {
        await interaction.editReply({ content: "❌ Error al cometer el crimen. Inténtalo de nuevo." });
      } catch {
        // Silently ignore if we can't edit the reply
      }
    }
  }
}
