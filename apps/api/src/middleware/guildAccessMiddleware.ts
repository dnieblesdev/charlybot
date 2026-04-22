import type { Context, Next } from 'hono';
import type { JwtPayload } from '../auth/jwt.types';
import { getSession } from '../auth/sessionStore';
import logger from '../utils/logger';

// Static path segments that should never be treated as guildId
const KNOWN_STATIC = new Set(['api', 'v1', 'guilds', 'economy', 'xp', 'music', 'autoroles', 'verifications', 'classes', 'auth', 'config', 'leaderboard', 'level-roles', 'queues', 'user', 'bank', 'roulette', 'game', 'bet', 'transfer', 'deposit', 'withdraw', 'increment', 'items', 'settings', 'position', 'upsert', 'health']);

/**
 * Extract guildId from URL path.
 * Finds the first segment after /api/v1/<route-prefix>/ that is NOT a known static segment.
 * Handles all route patterns:
 *   /api/v1/xp/leaderboard/:guildId
 *   /api/v1/economy/user/:guildId/:userId
 *   /api/v1/guilds/:id/config
 *   etc.
 */
function extractGuildId(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  // Skip /api/v1/<route-prefix>/ — find first non-static segment after that
  for (let i = 3; i < segments.length; i++) {
    const seg = segments[i];
    if (seg && !KNOWN_STATIC.has(seg)) {
      return seg;
    }
  }
  return null;
}

/**
 * Guild access validation middleware
 * Runs AFTER authMiddleware (jwtAuth)
 * Validates that the user has access to the guild specified in the route params
 *
 * @param c - Hono context
 * @param next - Next middleware/handler
 *
 * Checks if guildId is in c.get("jwt").guilds
 * Falls back to Valkey session if JWT guild list is stale
 * Returns 403 if access denied, 400 if no guildId param, 401 if no JWT
 */
export const guildAccessMiddleware = async (c: Context, next: Next) => {
  const guildId = extractGuildId(new URL(c.req.url).pathname);

  if (!guildId) {
    logger.warn('[guildAccessMiddleware] Could not extract guildId', {
      path: new URL(c.req.url).pathname,
    });
    c.status(400);
    return c.json({ error: 'Guild ID required' }, 400);
  }

  const jwt = c.get('jwt') as JwtPayload | undefined;

  // If no JWT (API key mode), skip guild validation — backward compat
  if (!jwt) {
    await next();
    return;
  }

  // Check JWT guilds first (fast path)
  if (jwt.guilds && jwt.guilds.includes(guildId)) {
    await next();
    return;
  }

  // Fallback: check Valkey session (JWT may be stale if guilds were added after login)
  try {
    const session = await getSession(jwt.userId);
    if (session?.guilds?.some(g => g.id === guildId)) {
      await next();
      return;
    }
  } catch (err) {
    logger.error('[guildAccessMiddleware] Session lookup failed', { error: err });
  }

  logger.warn('[guildAccessMiddleware] Access denied', { guildId, userId: jwt.userId, path: new URL(c.req.url).pathname });
  c.status(403);
  return c.json({ error: 'Access denied to this guild' }, 403);
};