import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import crypto from "node:crypto";
import { verifyAccessToken } from "../auth/jwt";
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

/**
 * Dual-mode auth middleware: JWT cookie OR X-API-Key header
 * - Valid JWT cookie → PASS (dashboard requests)
 * - Valid X-API-Key header → PASS (bot backward compat)
 * - Neither → 401
 */
export const authMiddleware = async (c: Context, next: Next) => {
  // Try JWT cookie first
  const accessToken = getCookie(c, "accessToken");

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) {
      c.set("jwt", payload);
      await next();
      return;
    }
  }

  // Fallback to API key
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
