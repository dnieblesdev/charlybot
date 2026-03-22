import type {
  VoiceConnection,
  AudioPlayer,
  AudioResource,
} from "@discordjs/voice";
import type { TextChannel, VoiceChannel, StageChannel } from "discord.js";

export interface Song {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requester: {
    id: string;
    username: string;
  };
}

export type LoopMode = "none" | "song" | "queue";

export interface MusicQueue {
  guildId: string;
  textChannel: TextChannel;
  voiceChannel: VoiceChannel | StageChannel;
  connection: VoiceConnection | null;
  player: AudioPlayer | null;
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loopMode: LoopMode;
  history: Song[];
}

export interface MusicServiceInterface {
  join(
    guildId: string,
    voiceChannel: VoiceChannel | StageChannel,
    textChannel: TextChannel,
  ): Promise<VoiceConnection>;
  leave(guildId: string): Promise<void>;
  getQueue(guildId: string): MusicQueue | undefined;
  clearQueue(guildId: string): void;
}
