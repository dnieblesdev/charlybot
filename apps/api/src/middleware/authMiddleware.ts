import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyAccessToken } from "../auth/jwt";
import logger from "../utils/logger";

/**
 * JWT-only auth middleware for dashboard requests.
 * Bot no longer communicates with API via HTTP — all data access is direct Prisma.
 *
 * Security notes:
 * - For cookie-based JWT, set SameSite=Strict on the cookie to mitigate CSRF.
 * - The Host header is user-controlled; never log it raw — sanitize before logging.
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const accessToken = getCookie(c, "accessToken");

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) {
      c.set("jwt", payload);
      await next();
      return;
    }
  }

  // Sanitize host — remove port if present and limit length to avoid log injection
  const rawHost = c.req.header("host") ?? "";
  const sanitizedHost = rawHost.split(":")[0]?.slice(0, 100) ?? "";
  logger.warn(
    {
      path: c.req.path,
      method: c.req.method,
    },
    `Unauthorized access attempt from host: ${sanitizedHost}`
  );
  return c.json({ error: "Unauthorized" }, 401);
};
