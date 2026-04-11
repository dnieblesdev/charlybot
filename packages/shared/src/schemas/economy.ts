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

// --- Roulette Schemas ---
export const RouletteGameSchema = z.object({
  guildId: z.string(),
  channelId: z.string(),
  messageId: z.string().optional(),
  status: z.string().default("waiting"),
  winningNumber: z.number().nullable().optional(),
  winningColor: z.string().nullable().optional(),
  startTime: z.union([z.date(), z.string().datetime()]).transform(val => 
    val instanceof Date ? val : new Date(val)
  ).default(new Date()),
  spinTime: z.union([z.date(), z.string().datetime()]).transform(val => 
    val instanceof Date ? val : new Date(val)
  ).nullable().optional(),
  endTime: z.union([z.date(), z.string().datetime()]).transform(val => 
    val instanceof Date ? val : new Date(val)
  ).nullable().optional(),
});

export const RouletteBetSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  amount: z.number().positive(),
  betType: z.enum(["color", "number"]),
  betValue: z.string(), // "red", "black", "green" or "0"-"36"
  result: z.string().nullable().optional(), // "win" or "lose"
  winAmount: z.number().nullable().optional(),
});

// --- Leaderboard Schemas ---
export const LeaderboardUpsertSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  totalMoney: z.number().default(0),
  joinedServerAt: z.union([z.date(), z.string().datetime()]).transform(val => 
    val instanceof Date ? val : new Date(val)
  ),
});

// --- Atomic Operations Schemas ---
export const TransferSchema = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  guildId: z.string(),
  amount: z.number().positive(),
  fromUsername: z.string(),
  toUsername: z.string(),
});

export const DepositSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  amount: z.number().positive(),
});

export const WithdrawSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  username: z.string(),
  amount: z.number().positive(),
});

export type IUserEconomy = z.infer<typeof UserEconomySchema>;
export type IGlobalBank = z.infer<typeof GlobalBankSchema>;
export type IEconomyConfig = z.infer<typeof EconomyConfigSchema>;
export type IRouletteGame = z.infer<typeof RouletteGameSchema>;
export type IRouletteBet = z.infer<typeof RouletteBetSchema>;
export type ILeaderboardUpsert = z.infer<typeof LeaderboardUpsertSchema>;
export type ITransfer = z.infer<typeof TransferSchema>;
export type IDeposit = z.infer<typeof DepositSchema>;
export type IWithdraw = z.infer<typeof WithdrawSchema>;
