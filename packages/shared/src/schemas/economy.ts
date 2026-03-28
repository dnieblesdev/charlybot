import { z } from 'zod';

// Helper para aceptar Date o string ISO
const dateSchema = z.union([z.date(), z.string().datetime()]).transform(val => 
  val instanceof Date ? val : new Date(val)
).nullable().optional();

export const UserEconomySchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  pocket: z.number().default(0),
  inJail: z.boolean().default(false),
  jailReleaseAt: dateSchema,
  lastWork: dateSchema,
  lastCrime: dateSchema,
  lastRob: dateSchema,
  totalEarned: z.number().default(0),
  totalLost: z.number().default(0),
});

export const GlobalBankSchema = z.object({
  userId: z.string(),
  username: z.string(),
  bank: z.number().default(0),
});

export const EconomyConfigSchema = z.object({
  guildId: z.string(),
  workCooldown: z.number().default(300000),
  crimeCooldown: z.number().default(900000),
  robCooldown: z.number().default(1800000),
  workMinAmount: z.number().default(100),
  workMaxAmount: z.number().default(300),
  crimeMultiplier: z.number().default(3),
  startingMoney: z.number().default(1000),
  jailTimeWork: z.number().default(30),
  jailTimeRob: z.number().default(45),
  rouletteChannelId: z.string().nullable().optional(),
});

export type IUserEconomy = z.infer<typeof UserEconomySchema>;
export type IGlobalBank = z.infer<typeof GlobalBankSchema>;
export type IEconomyConfig = z.infer<typeof EconomyConfigSchema>;
