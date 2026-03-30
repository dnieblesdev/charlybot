import type { Context, Next } from "hono";
import logger from "../utils/logger";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error(
    "API_KEY environment variable is required. Set it before starting the server.",
  );
}

export const authMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey || apiKey !== API_KEY) {
    logger.warn(`Unauthorized access attempt from ${c.req.header("host")}`, {
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
