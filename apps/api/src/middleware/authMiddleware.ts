import type { Context, Next } from "hono";
import logger from "../utils/logger";

export const authMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header("X-API-Key");
  const expectedKey = process.env.API_KEY || "charly_secret_key"; // Temporary fallback

  if (!apiKey || apiKey !== expectedKey) {
    logger.warn(`Unauthorized access attempt from ${c.req.header("host")}`, {
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
