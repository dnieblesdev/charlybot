import type { Context, Next } from "hono";
import type { JwtPayload } from "../auth/jwt.types";
import { verifyAccessToken } from "../auth/jwt";
import logger from "../utils/logger";

/**
 * JWT authentication middleware for Hono
 * Reads Authorization: Bearer <token> header, verifies JWT, sets claims in context
 */
export async function jwtAuth(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing or invalid Authorization header", {
      path: c.req.path,
      method: c.req.method,
    });
    c.status(401);
    await c.json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

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