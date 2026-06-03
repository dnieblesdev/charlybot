import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { JwtPayload } from "../auth/jwt.types";
import { verifyAccessToken } from "../auth/jwt";
import logger from "../utils/logger";

/**
 * JWT authentication middleware for Hono
 * Reads JWT from accessToken cookie first, falls back to Authorization: Bearer header
 */
export async function jwtAuth(c: Context, next: Next) {
  // Try cookie first
  let token = getCookie(c, "accessToken");

  // Fallback to Authorization header if no cookie
  if (!token) {
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    logger.warn(
      {
        path: c.req.path,
        method: c.req.method,
      },
      "Missing JWT token"
    );
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    logger.warn(
      {
        path: c.req.path,
        method: c.req.method,
      },
      "Invalid or expired JWT token"
    );
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Set the JWT payload in context for use in route handlers
  c.set("jwt", payload);

  await next();
}
