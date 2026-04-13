import type { Context, Next } from "hono";
import crypto from "node:crypto";
import logger from "../utils/logger";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error(
    "API_KEY environment variable is required. Set it before starting the server.",
  );
}

/**
 * Timing-safe comparison of API keys
 * Pads both buffers to equal length to prevent timing attacks on length
 */
function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  // Pad both to the same length to prevent timing leaks on length mismatch
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);

  return crypto.timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey || !timingSafeCompare(apiKey, API_KEY)) {
    logger.warn(`Unauthorized access attempt from ${c.req.header("host")}`, {
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
