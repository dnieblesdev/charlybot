// Const pattern for TypeScript: single source of truth + runtime values + autocomplete
// Usage: const STATUS = createConst({ A: 'a', B: 'b' }); type Status = typeof STATUS[keyof typeof STATUS];

/**
 * Creates a const object with type inference.
 * @param obj Object with string values
 * @returns Object frozen with string literal value types
 */
export function createConst<T extends Record<string, string>>(
  obj: T,
): Readonly<{
  [K in keyof T]: T[K];
}> {
  return Object.freeze(obj) as never;
}

// ============================================================================
// Limits & Boundaries
// ============================================================================

/** Maximum items allowed in a music queue */
export const MAX_QUEUE_SIZE = 500;

/** Maximum entries returned by any leaderboard query */
export const MAX_LEADERBOARD_LIMIT = 100;