/**
 * Central registry for all Discord component customId values.
 *
 * Convention: `feature:action[:payload]`
 *   - feature  — subsystem name (verification, autorole, welcome, ...)
 *   - action   — operation within the subsystem
 *   - payload  — optional runtime data (userId, roleId, channelId, ...)
 *   - `:` is the only structural separator; `_` may appear inside payload values
 *
 * Static customIds are plain strings.
 * Dynamic customIds are factory functions that return a string.
 */

// ─── Feature segment constants ───────────────────────────────────────────────

export const FEATURES = {
  VERIFICATION: "verification",
  AUTOROLE: "autorole",
  WELCOME: "welcome",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

// ─── Typed customId registry ──────────────────────────────────────────────────

export const CUSTOM_IDS = {
  // ── Verification ────────────────────────────────────────────────────────────
  verification: {
    /** Button: user clicks "Verificarme" */
    START: "verification:start" as const,

    /** Button: moderator approves a pending verification */
    APPROVE: (userId: string): string => `verification:approve:${userId}`,

    /** Button: moderator rejects a pending verification */
    REJECT: (userId: string): string => `verification:reject:${userId}`,

    /** Modal: user submits their in-game name */
    MODAL: (userId: string): string => `verification:modal:${userId}`,

    /** Select menu: user picks their class */
    CLASS_SELECT: (userId: string): string =>
      `verification:class-select:${userId}`,

    /** Select menu: user picks their subclass */
    SUBCLASS_SELECT: (userId: string, className: string): string =>
      `verification:subclass-select:${userId}:${className}`,
  },

  // ── AutoRole — config buttons (handled by session collector in setup.ts) ───
  autorole: {
    config: {
      ADD_MAPPING: "autorole:config:add_mapping" as const,
      EDIT_MAPPING: "autorole:config:edit_mapping" as const,
      REMOVE_MAPPING: "autorole:config:remove_mapping" as const,
      TOGGLE_MODE: "autorole:config:toggle_mode" as const,
      CUSTOMIZE_EMBED: "autorole:config:customize_embed" as const,
      FINISH: "autorole:config:finish" as const,
      CANCEL: "autorole:config:cancel" as const,
      CONFIRM_REMOVE: "autorole:config:confirm_remove" as const,
      CANCEL_REMOVE: "autorole:config:cancel_remove" as const,
    },

    // ── AutoRole — select menus (handled by session collector in setup.ts) ───
    select: {
      EDIT: "autorole:select:edit" as const,
      REMOVE: "autorole:select:remove" as const,
    },

    // ── AutoRole — modals (handled by setup.ts handleModalSubmit) ────────────
    modal: {
      INITIAL: "autorole:modal:initial" as const,
      ADD_MAPPING: "autorole:modal:add_mapping" as const,

      /** Modal: customize embed — sessionId is usually the userId */
      CUSTOMIZE: (sessionId: string): string =>
        `autorole:modal:customize:${sessionId}`,
    },

    // ── AutoRole — public role-assignment buttons ─────────────────────────────
    /** Button placed on public messages to assign/remove a role */
    ASSIGN: (roleId: string): string => `autorole:assign:${roleId}`,
  },

  // ── Welcome ─────────────────────────────────────────────────────────────────
  welcome: {
    /** Modal: user submits welcome message text */
    MODAL: (channelId: string): string => `welcome:modal:${channelId}`,
  },
} as const;

// ─── parseCustomId ────────────────────────────────────────────────────────────

export interface ParsedCustomId {
  /** The feature segment, e.g. "verification", "autorole", "welcome" */
  feature: string;
  /** The action segment, e.g. "start", "approve", "assign" */
  action: string;
  /**
   * The first payload segment (third colon-delimited part), or undefined
   * when the customId has no payload.
   */
  payload: string | undefined;
  /**
   * All payload parts (everything after feature:action, split by `:`)
   * Useful when payloads contain multiple segments (e.g. subclass-select).
   */
  payloadParts: string[];
  /** The original unmodified customId string */
  raw: string;
}

/**
 * Parses a `feature:action[:payload...]` customId string into its components.
 *
 * @example
 * parseCustomId("verification:approve:123456")
 * // → { feature: "verification", action: "approve", payload: "123456", payloadParts: ["123456"], raw: "verification:approve:123456" }
 *
 * parseCustomId("autorole:assign:987654321")
 * // → { feature: "autorole", action: "assign", payload: "987654321", payloadParts: ["987654321"], raw: "autorole:assign:987654321" }
 *
 * parseCustomId("verification:subclass-select:111:Dark Knight")
 * // → { feature: "verification", action: "subclass-select", payload: "111", payloadParts: ["111", "Dark Knight"], raw: "..." }
 *
 * parseCustomId("verification:start")
 * // → { feature: "verification", action: "start", payload: undefined, payloadParts: [], raw: "verification:start" }
 */
export function parseCustomId(customId: string): ParsedCustomId {
  const parts = customId.split(":");
  const feature = parts[0] ?? "";
  const action = parts[1] ?? "";
  const payloadParts = parts.slice(2);
  const payload = payloadParts.length > 0 ? payloadParts[0] : undefined;

  return { feature, action, payload, payloadParts, raw: customId };
}
