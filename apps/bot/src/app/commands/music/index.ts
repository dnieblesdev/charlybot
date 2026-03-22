import { SlashCommandBuilder } from "@discordjs/builders";
import type { ChatInputCommandInteraction } from "discord.js";
import { execute as playExecute } from "./play.ts";
import { execute as skipExecute } from "./skip.ts";
import { execute as playlistExecute } from "./playlist.ts";
import { execute as nowplayingExecute } from "./nowplaying.ts";
import { execute as pauseExecute } from "./pause.ts";
import { execute as resumeExecute } from "./resume.ts";
import { execute as stopExecute } from "./stop.ts";
import { execute as loopExecute } from "./loop.ts";
import { execute as shuffleExecute } from "./shuffle.ts";
import { execute as volumeExecute } from "./volume.ts";
import { execute as removeExecute } from "./remove.ts";
import { execute as clearExecute } from "./clear.ts";
import { execute as joinExecute } from "./join.ts";
import { execute as leaveExecute } from "./leave.ts";

export const data = new SlashCommandBuilder()
  .setName("music")
  .setDescription("Comandos de música")
  .addSubcommand((sub) =>
    sub
      .setName("play")
      .setDescription("Reproduce una canción o playlist de YouTube/Spotify")
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("URL o nombre de la canción/playlist")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("skip").setDescription("Salta a la siguiente canción"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("playlist")
      .setDescription("Muestra la cola de reproducción actual")
      .addIntegerOption((option) =>
        option
          .setName("page")
          .setDescription("Número de página a mostrar")
          .setRequired(false)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("nowplaying")
      .setDescription(
        "Muestra la canción que se está reproduciendo actualmente",
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("pause").setDescription("Pausa la reproducción actual"),
  )
  .addSubcommand((sub) =>
    sub.setName("resume").setDescription("Reanuda la reproducción pausada"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("stop")
      .setDescription("Detiene la reproducción y limpia la cola"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("loop")
      .setDescription("Configura el modo de repetición")
      .addStringOption((option) =>
        option
          .setName("mode")
          .setDescription("Modo de repetición")
          .setRequired(true)
          .addChoices(
            { name: "Desactivar", value: "none" },
            { name: "Repetir canción", value: "song" },
            { name: "Repetir cola", value: "queue" },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("shuffle")
      .setDescription("Mezcla aleatoriamente la cola de reproducción"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("volume")
      .setDescription("Ajusta el volumen de la reproducción")
      .addIntegerOption((option) =>
        option
          .setName("level")
          .setDescription("Nivel de volumen (0-200)")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(200),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Elimina una canción de la cola")
      .addIntegerOption((option) =>
        option
          .setName("position")
          .setDescription("Posición de la canción en la cola")
          .setRequired(true)
          .setMinValue(1),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Limpia la cola sin detener la canción actual"),
  )
  .addSubcommand((sub) =>
    sub.setName("join").setDescription("Une el bot a tu canal de voz"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("leave")
      .setDescription("Hace que el bot salga del canal de voz"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "play":
      await playExecute(interaction);
      break;
    case "skip":
      await skipExecute(interaction);
      break;
    case "playlist":
      await playlistExecute(interaction);
      break;
    case "nowplaying":
      await nowplayingExecute(interaction);
      break;
    case "pause":
      await pauseExecute(interaction);
      break;
    case "resume":
      await resumeExecute(interaction);
      break;
    case "stop":
      await stopExecute(interaction);
      break;
    case "loop":
      await loopExecute(interaction);
      break;
    case "shuffle":
      await shuffleExecute(interaction);
      break;
    case "volume":
      await volumeExecute(interaction);
      break;
    case "remove":
      await removeExecute(interaction);
      break;
    case "clear":
      await clearExecute(interaction);
      break;
    case "join":
      await joinExecute(interaction);
      break;
    case "leave":
      await leaveExecute(interaction);
      break;
  }
}
