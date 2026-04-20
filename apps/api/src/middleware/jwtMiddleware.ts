import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { JwtPayload } from "../auth/jwt.types";
import { verifyAccessToken } from "../auth/jwt";
import logger from "../utils/logger";

/**
 * JWT authentication middleware for Hono
 * Reads JWT from accessToken cookie first, falls back to Authorization: Bearer header
 */
export async function jwtAuth(c: Context, next: Next): Promise<void> {
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
    logger.warn("Missing JWT token", {
      path: c.req.path,
      method: c.req.method,
    });
    c.status(401);
    await c.json({ error: "Unauthorized" });
    return;
  }

  const payload = await verifyAccessToken(token);

  if (!payload) {
    logger.warn("Invalid or expired JWT token", {
      path: c.req.path,
      method: c.req.method,
    });
    c.status(401);
    await c.json({ error: "Unauthorized" });
    return;
  }

  // Set the JWT payload in context for use in route handlers
  c.set("jwt", payload);

  await next();
}

/**
 * Extension for Hono context to include jwt property
 */
declare module "hono" {
  interface ContextVariableMap {
    jwt: JwtPayload;
  }
}