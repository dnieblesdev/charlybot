import type { Context, Next } from 'hono';
import type { JwtPayload } from '../auth/jwt.types';

/**
 * Guild access validation middleware
 * Runs AFTER authMiddleware (jwtAuth)
 * Validates that the user has access to the guild specified in the route params
 *
 * @param c - Hono context
 * @param next - Next middleware/handler
 *
 * Accepts :guildId or :id from route params
 * Checks if guildId is in c.get("jwt").guilds
 * Returns 403 if access denied, 400 if no guildId param, 401 if no JWT
 */
export const guildAccessMiddleware = async (c: Context, next: Next) => {
  // Try :guildId first, fallback to :id (guilds.ts uses :id)
  const guildId = c.req.param('guildId') || c.req.param('id');

  if (!guildId) {
    c.status(400);
    return c.json({ error: 'Guild ID required' }, 400);
  }

  const jwt = c.get('jwt') as JwtPayload | undefined;

  // If no JWT (API key mode), skip guild validation — backward compat
  if (!jwt) {
    await next();
    return;
  }

  if (!jwt.guilds || !jwt.guilds.includes(guildId)) {
    c.status(403);
    return c.json({ error: 'Access denied to this guild' }, 403);
  }

  await next();
};