import type { z } from "zod";
import type {
  ModCaseSchema,
  WarnThresholdSchema,
  ModerationConfigSchema,
  ModActionTypeSchema,
} from "@charlybot/shared/schemas/moderation";

export type ModActionType = z.infer<typeof ModActionTypeSchema>;

export interface ModCaseData {
  id?: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  caseNumber: number;
  type: ModActionType;
  reason?: string | null;
  duration?: bigint | null;
  active: boolean;
  messageCount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WarnThresholdData {
  id?: number;
  guildId: string;
  warnCount: number;
  action: "timeout" | "kick" | "ban";
  duration?: bigint | null;
}

export interface ModerationConfigData {
  modLogChannelId?: string | null;
  modRoleId?: string | null;
}

export interface AntiSpamRateLimit {
  maxMessages: number;
  windowSeconds: number;
}

export interface AntiSpamResult {
  allowed: boolean;
  level: number;
  reason?: string;
}

export interface ModCaseResult {
  success: boolean;
  caseNumber?: number;
  error?: string;
}
