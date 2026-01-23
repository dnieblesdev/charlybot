import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import logger, { logCommand } from "../../utils/logger.js";
import { EconomyConfigService } from "../services/economy/EconomyConfigService.js";

export const data = new SlashCommandBuilder()
  .setName("economy-config")
  .setDescription(
    "Configura el sistema de economía del servidor (Solo administradores)",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("view")
      .setDescription("Ver la configuración actual de economía"),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-work-cooldown")
      .setDescription("Establece el cooldown del comando /work")
      .addIntegerOption((option) =>
        option
          .setName("minutos")
          .setDescription("Minutos de cooldown (1-120)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(120),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-crime-cooldown")
      .setDescription("Establece el cooldown del comando /crime")
      .addIntegerOption((option) =>
        option
          .setName("minutos")
          .setDescription("Minutos de cooldown (1-180)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(180),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-rob-cooldown")
      .setDescription("Establece el cooldown del comando /rob")
      .addIntegerOption((option) =>
        option
          .setName("minutos")
          .setDescription("Minutos de cooldown (1-240)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(240),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-work-amounts")
      .setDescription("Establece el rango de ganancias de /work")
      .addIntegerOption((option) =>
        option
          .setName("minimo")
          .setDescription("Ganancia mínima ($)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10000),
      )
      .addIntegerOption((option) =>
        option
          .setName("maximo")
          .setDescription("Ganancia máxima ($)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10000),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-crime-multiplier")
      .setDescription("Establece el multiplicador de ganancias de /crime")
      .addIntegerOption((option) =>
        option
          .setName("multiplicador")
          .setDescription("Multiplicador (2-10)")
          .setRequired(true)
          .setMinValue(2)
          .setMaxValue(10),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-starting-money")
      .setDescription("Establece el dinero inicial para nuevos usuarios")
      .addIntegerOption((option) =>
        option
          .setName("cantidad")
          .setDescription("Cantidad inicial ($)")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(100000),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-jail-times")
      .setDescription("Establece los tiempos de prisión")
      .addIntegerOption((option) =>
        option
          .setName("crime")
          .setDescription("Minutos de prisión por crime fallido (1-120)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(120),
      )
      .addIntegerOption((option) =>
        option
          .setName("rob")
          .setDescription("Minutos de prisión por rob fallido (1-120)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(120),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("set-roulette-channel")
      .setDescription("Establece un canal dedicado para el comando /ruleta")
      .addChannelOption((option) =>
        option
          .setName("canal")
          .setDescription(
            "Canal donde se podrá usar /ruleta (déjalo vacío para permitir todos)",
          )
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("reset")
      .setDescription("Resetea toda la configuración a valores por defecto"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    logCommand(
      interaction.user.id,
      interaction.guildId || "DM",
      "economy-config",
    );

    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    switch (subcommand) {
      case "view":
        await handleView(interaction, guildId);
        break;
      case "set-work-cooldown":
        await handleSetWorkCooldown(interaction, guildId);
        break;
      case "set-crime-cooldown":
        await handleSetCrimeCooldown(interaction, guildId);
        break;
      case "set-rob-cooldown":
        await handleSetRobCooldown(interaction, guildId);
        break;
      case "set-work-amounts":
        await handleSetWorkAmounts(interaction, guildId);
        break;
      case "set-crime-multiplier":
        await handleSetCrimeMultiplier(interaction, guildId);
        break;
      case "set-starting-money":
        await handleSetStartingMoney(interaction, guildId);
        break;
      case "set-jail-times":
        await handleSetJailTimes(interaction, guildId);
        break;
      case "set-roulette-channel":
        await handleSetRouletteChannel(interaction, guildId);
        break;
      case "reset":
        await handleReset(interaction, guildId);
        break;
      default:
        await interaction.editReply({
          content: "❌ Subcomando no reconocido.",
        });
    }
  } catch (error) {
    logger.error("Error executing economy-config command", {
      error: error instanceof Error ? error.message : String(error),
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });

    const errorMessage =
      "❌ Error al configurar la economía. Inténtalo de nuevo.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const config = await EconomyConfigService.getOrCreateConfig(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x00aaff)
    .setTitle("⚙️ Configuración de Economía")
    .setDescription(`Configuración actual para este servidor`)
    .addFields(
      {
        name: "⏰ Cooldowns",
        value:
          `**Work:** ${config.workCooldown / 60000} minutos\n` +
          `**Crime:** ${config.crimeCooldown / 60000} minutos\n` +
          `**Rob:** ${config.robCooldown / 60000} minutos`,
        inline: true,
      },
      {
        name: "💰 Ganancias",
        value:
          `**Work:** $${config.workMinAmount} - $${config.workMaxAmount}\n` +
          `**Crime Multiplier:** x${config.crimeMultiplier}\n` +
          `**Dinero Inicial:** $${config.startingMoney}`,
        inline: true,
      },
      {
        name: "🚔 Prisión",
        value:
          `**Crime Fallido:** ${config.jailTimeWork} minutos\n` +
          `**Rob Fallido:** ${config.jailTimeRob} minutos`,
        inline: false,
      },
      {
        name: "🎰 Canal de Ruleta",
        value: config.rouletteChannelId
          ? `<#${config.rouletteChannelId}>`
          : "Permitido en todos los canales",
        inline: false,
      },
    )
    .setFooter({
      text: "Usa /economy-config para modificar estos valores",
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetWorkCooldown(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const minutes = interaction.options.getInteger("minutos", true);

  await EconomyConfigService.updateWorkCooldown(guildId, minutes);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      `El cooldown de **Work** se ha establecido en **${minutes} minutos**.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(
    `Work cooldown updated to ${minutes} minutes in guild ${guildId}`,
  );
}

async function handleSetCrimeCooldown(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const minutes = interaction.options.getInteger("minutos", true);

  await EconomyConfigService.updateCrimeCooldown(guildId, minutes);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      `El cooldown de **Crime** se ha establecido en **${minutes} minutos**.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(
    `Crime cooldown updated to ${minutes} minutes in guild ${guildId}`,
  );
}

async function handleSetRobCooldown(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const minutes = interaction.options.getInteger("minutos", true);

  await EconomyConfigService.updateRobCooldown(guildId, minutes);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      `El cooldown de **Rob** se ha establecido en **${minutes} minutos**.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(`Rob cooldown updated to ${minutes} minutes in guild ${guildId}`);
}

async function handleSetWorkAmounts(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const minAmount = interaction.options.getInteger("minimo", true);
  const maxAmount = interaction.options.getInteger("maximo", true);

  if (minAmount > maxAmount) {
    await interaction.editReply({
      content: "❌ El mínimo no puede ser mayor que el máximo.",
    });
    return;
  }

  await EconomyConfigService.updateWorkAmounts(guildId, minAmount, maxAmount);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      `Las ganancias de **Work** se han establecido en **$${minAmount} - $${maxAmount}**.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(
    `Work amounts updated to $${minAmount}-$${maxAmount} in guild ${guildId}`,
  );
}

async function handleSetCrimeMultiplier(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const multiplier = interaction.options.getInteger("multiplicador", true);

  await EconomyConfigService.updateCrimeMultiplier(guildId, multiplier);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      `El multiplicador de **Crime** se ha establecido en **x${multiplier}**.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(`Crime multiplier updated to x${multiplier} in guild ${guildId}`);
}

async function handleSetStartingMoney(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const amount = interaction.options.getInteger("cantidad", true);

  await EconomyConfigService.updateStartingMoney(guildId, amount);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      `El dinero inicial para nuevos usuarios se ha establecido en **$${amount}**.\n\n` +
        `⚠️ Esto solo afecta a usuarios que se registren a partir de ahora.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(`Starting money updated to $${amount} in guild ${guildId}`);
}

async function handleSetJailTimes(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const crimeJailTime = interaction.options.getInteger("crime");
  const robJailTime = interaction.options.getInteger("rob");

  if (!crimeJailTime && !robJailTime) {
    await interaction.editReply({
      content: "❌ Debes especificar al menos un tiempo de prisión.",
    });
    return;
  }

  await EconomyConfigService.updateJailTimes(
    guildId,
    crimeJailTime || undefined,
    robJailTime || undefined,
  );

  let description = "Los tiempos de prisión se han actualizado:\n\n";
  if (crimeJailTime) {
    description += `**Crime Fallido:** ${crimeJailTime} minutos\n`;
  }
  if (robJailTime) {
    description += `**Rob Fallido:** ${robJailTime} minutos\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(description)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(
    `Jail times updated in guild ${guildId}: crime=${crimeJailTime}, rob=${robJailTime}`,
  );
}

async function handleSetRouletteChannel(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  const channel = interaction.options.getChannel("canal");

  await EconomyConfigService.updateRouletteChannel(
    guildId,
    channel?.id || null,
  );

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("✅ Configuración Actualizada")
    .setDescription(
      channel
        ? `El comando **/ruleta** ahora solo se puede usar en <#${channel.id}>.`
        : `El comando **/ruleta** ahora se puede usar en cualquier canal.`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(
    `Roulette channel updated in guild ${guildId}: ${channel?.id || "removed"}`,
  );
}

async function handleReset(
  interaction: ChatInputCommandInteraction,
  guildId: string,
) {
  await EconomyConfigService.resetConfig(guildId);

  const embed = new EmbedBuilder()
    .setColor(0xff9900)
    .setTitle("🔄 Configuración Reseteada")
    .setDescription(
      `La configuración de economía se ha reseteado a los valores por defecto:\n\n` +
        `**Cooldowns:**\n` +
        `• Work: 5 minutos\n` +
        `• Crime: 15 minutos\n` +
        `• Rob: 30 minutos\n\n` +
        `**Ganancias:**\n` +
        `• Work: $100-$300\n` +
        `• Crime Multiplier: x3\n` +
        `• Dinero Inicial: $1000\n\n` +
        `**Prisión:**\n` +
        `• Crime Fallido: 30 minutos\n` +
        `• Rob Fallido: 45 minutos\n\n` +
        `**Canal de Ruleta:**\n` +
        `• Permitido en todos los canales`,
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info(`Economy config reset to defaults in guild ${guildId}`);
}
