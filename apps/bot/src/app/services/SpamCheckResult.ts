/**
 * Type-safe enum for anti-spam actions.
 * Maps DB string values to enum members for type-safe switch statements.
 */
export enum AntiSpamAction {
  WARN = "warn",
  TIMEOUT_5MIN = "timeout_5min",
  TIMEOUT_30MIN = "timeout_30min",
  NOTIFY_ONLY = "notify_only",
  DELETE_ONLY = "delete_only",
}

/**
 * Helper to convert a string to AntiSpamAction enum.
 * Falls back to WARN for unknown values.
 */
export function toAntiSpamAction(value: string): AntiSpamAction {
  switch (value) {
    case "warn":
      return AntiSpamAction.WARN;
    case "timeout_5min":
      return AntiSpamAction.TIMEOUT_5MIN;
    case "timeout_30min":
      return AntiSpamAction.TIMEOUT_30MIN;
    case "notify_only":
      return AntiSpamAction.NOTIFY_ONLY;
    case "delete_only":
      return AntiSpamAction.DELETE_ONLY;
    default:
      return AntiSpamAction.WARN;
  }
}

/**
 * Result returned by AntiSpamService.evaluate()
 */
export interface SpamCheckResult {
  isSpam: boolean;
  /** Pattern name: "rateLimit" | "burst" | "velocity" | "mention" | "link" | "duplicate" | "caps" | "emoji" | "combo" | "" */
  pattern: string;
  /** Action to take */
  action: AntiSpamAction;
  /** Human-readable reason */
  reason: string;
  /** Message IDs for bulk actions (burst patterns) */
  messageIds?: { id: string; channelId: string }[];
}