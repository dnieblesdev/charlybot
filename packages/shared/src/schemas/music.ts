import { z } from 'zod';

export const MusicQueueItemSchema = z.object({
  id: z.string().optional(),
  queueId: z.string(),
  title: z.string(),
  url: z.string().url(),
  duration: z.number().int().min(0),
  thumbnail: z.string().url().nullable().optional(),
  position: z.number().int().min(0),
  requesterId: z.string(),
  requesterName: z.string(),
  createdAt: z.date().optional(),
});

export const MusicQueueSchema = z.object({
  id: z.string().optional(),
  guildId: z.string(),
  currentSongId: z.string().nullable().optional(),
  isPlaying: z.boolean().default(false),
  isPaused: z.boolean().default(false),
  volume: z.number().int().min(0).max(200).default(100),
  loopMode: z.enum(['none', 'song', 'queue']).default('none'),
  lastSeek: z.number().int().min(0).default(0),
  updatedAt: z.date().optional(),
  createdAt: z.date().optional(),
  items: z.array(MusicQueueItemSchema).optional(),
});

export const GuildMusicConfigSchema = z.object({
  id: z.string().optional(),
  guildId: z.string(),
  defaultVolume: z.number().int().min(0).max(200).default(100),
  autoCleanup: z.boolean().default(true),
  maxQueueSize: z.number().int().min(1).default(500),
  updatedAt: z.date().optional(),
  createdAt: z.date().optional(),
});

export type IMusicQueueItem = z.infer<typeof MusicQueueItemSchema>;
export type IMusicQueue = z.infer<typeof MusicQueueSchema>;
export type IGuildMusicConfig = z.infer<typeof GuildMusicConfigSchema>;
