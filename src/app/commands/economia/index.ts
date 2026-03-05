import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";

import { execute as balance } from "./balance";
import { execute as deposit } from "./deposit";
import { execute as retirar } from "./retirar";
import { execute as work } from "./work";
import { execute as crime } from "./crime";
import { execute as rob } from "./rob";
import { execute as ruleta } from "./ruleta";
import { execute as leaderboard } from "./leaderboard";
import { execute as bail } from "./bail";
import { execute as economyConfig } from "./economy-config";

export const data = new SlashCommandBuilder()
  .setName("economia")
  .setDescription("Sistema de economía del servidor")

  // subcomando: balance
  .addSubcommand((subcommand) =>
    subcommand
      .setName("balance")
      .setDescription("Muestra tu balance de dinero o el de otro usuario")
      .addUserOption((option) =>
        option
          .setName("usuario")
          .setDescription("Usuario del que quieres ver el balance (opcional)")
          .setRequired(false),
      ),
  )

  // subcomando: deposit
  .addSubcommand((subcommand) =>
    subcommand
      .setName("deposit")
      .setDescription("Deposita dinero de tu bolsillo al banco")
      .addIntegerOption((option) =>
        option
          .setName("cantidad")
          .setDescription(
            "Cantidad a depositar (usa 'all' para depositar todo)",
          )
          .setRequired(true)
          .setMinValue(1),
      ),
  )

  // subcomando: retirar
  .addSubcommand((subcommand) =>
    subcommand
      .setName("retirar")
      .setDescription("Retira dinero del banco a tu bolsillo")
      .addIntegerOption((option) =>
        option
          .setName("cantidad")
          .setDescription("Cantidad a retirar (usa 'all' para retirar todo)")
          .setRequired(true)
          .setMinValue(1),
      ),
  )

  // subcomando: work
  .addSubcommand((subcommand) =>
    subcommand
      .setName("work")
      .setDescription("Trabaja para ganar dinero"),
  )

  // subcomando: crime
  .addSubcommand((subcommand) =>
    subcommand
      .setName("crime")
      .setDescription("Comete un crimen para ganar dinero (con riesgo)"),
  )

  // subcomando: rob
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rob")
      .setDescription("Intenta robar dinero del bolsillo de otro usuario")
      .addUserOption((option) =>
        option
          .setName("usuario")
          .setDescription("Usuario al que quieres robar")
          .setRequired(true),
      ),
  )

  // subcomando: ruleta
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ruleta")
      .setDescription("Juega a la ruleta y apuesta tu dinero")
      .addStringOption((option) =>
        option
          .setName("tipo")
          .setDescription("Tipo de apuesta: color o número")
          .setRequired(true)
          .addChoices(
            { name: "Color (x2)", value: "color" },
            { name: "Número (x36)", value: "number" },
          ),
      )
      .addStringOption((option) =>
        option
          .setName("apuesta")
          .setDescription("Tu apuesta: red/black/green o número (0-36)")
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("cantidad")
          .setDescription("Cantidad de dinero a apostar")
          .setRequired(true)
          .setMinValue(1),
      ),
  )

  // subcomando: leaderboard
  .addSubcommand((subcommand) =>
    subcommand
      .setName("leaderboard")
      .setDescription(
        "Muestra el ranking de los usuarios más ricos del servidor",
      )
      .addIntegerOption((option) =>
        option
          .setName("cantidad")
          .setDescription("Cantidad de usuarios a mostrar (por defecto 10)")
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(25),
      ),
  )

  // subcomando: bail
  .addSubcommand((subcommand) =>
    subcommand
      .setName("bail")
      .setDescription("Paga tu fianza para salir de la prisión"),
  )

  // subcomando grupo: config (economy-config)
  .addSubcommandGroup((group) =>
    group
      .setName("config")
      .setDescription(
        "Configura el sistema de economía del servidor (Solo administradores)",
      )
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
              .setDescription(
                "Minutos de prisión por crime fallido (1-120)",
              )
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(120),
          )
          .addIntegerOption((option) =>
            option
              .setName("rob")
              .setDescription(
                "Minutos de prisión por rob fallido (1-120)",
              )
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(120),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set-roulette-channel")
          .setDescription(
            "Establece un canal dedicado para el comando /ruleta",
          )
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
          .setDescription(
            "Resetea toda la configuración a valores por defecto",
          ),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (group === "config") {
    await economyConfig(interaction);
    return;
  }

  switch (subcommand) {
    case "balance":
      await balance(interaction);
      break;
    case "deposit":
      await deposit(interaction);
      break;
    case "retirar":
      await retirar(interaction);
      break;
    case "work":
      await work(interaction);
      break;
    case "crime":
      await crime(interaction);
      break;
    case "rob":
      await rob(interaction);
      break;
    case "ruleta":
      await ruleta(interaction);
      break;
    case "leaderboard":
      await leaderboard(interaction);
      break;
    case "bail":
      await bail(interaction);
      break;
    default:
      await interaction.reply({
        content: "Comando no reconocido",
        flags: [MessageFlags.Ephemeral],
      });
      break;
  }
}
