import type { Context, Next } from "hono";
import { sanitizeUrlPath } from "../utils/logger";

/**
 * Access log middleware.
 *
 * Runs after request handlers. Measures latency from before `await next()` to
 * after, then emits a structured `type: "http_access"` log via the child logger
 * stored in context by `requestId` middleware.
 *
 * Must run AFTER requestId middleware so `c.get("logger")` is available.
 */
export function accessLog(c: Context, next: Next) {
  const start = Date.now();

  return next().then(() => {
    const childLogger = c.get("logger");
    if (!childLogger) return;

    const latency_ms = Date.now() - start;
    const sanitizedPath = sanitizeUrlPath(c.req.url);
    const request_id = (childLogger as any).bindings?.request_id;

    childLogger.info(
      {
        type: "http_access",
        method: c.req.method,
        path: sanitizedPath,
        status: c.res.status,
        latency_ms,
        ...(request_id && { request_id }),
      },
      `${c.req.method} ${sanitizedPath}`,
    );
  });
}
