import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyAccessToken } from "../auth/jwt";
import logger from "../utils/logger";

/**
 * JWT-only auth middleware for dashboard requests.
 * Bot no longer communicates with API via HTTP — all data access is direct Prisma.
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

  logger.warn(`Unauthorized access attempt from ${c.req.header("host")}`, {
    path: c.req.path,
    method: c.req.method,
  });
  return c.json({ error: "Unauthorized" }, 401);
};
