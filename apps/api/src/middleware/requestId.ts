import type { Context, Next } from "hono";
import logger from "../utils/logger";

/**
 * Request ID middleware.
 *
 * Reads the `X-Request-ID` header from the incoming request. If absent,
 * generates a v4 UUID. Attaches a child logger with `request_id` to the
 * Hono context via `c.set("logger", childLogger)` so handlers and services
 * can retrieve it with `c.get("logger")`.
 *
 * Must run FIRST in the middleware chain so `request_id` is available to
 * all downstream middleware and handlers.
 */
export function requestId(c: Context, next: Next) {
  const requestId =
    c.req.header("X-Request-ID") ||
    crypto.randomUUID();

  const child = logger.child({ request_id: requestId });

  c.set("logger", child);
  c.header("X-Request-ID", requestId);

  return next();
}
