import type pino from "pino";
import type { Context } from "hono";
import { sanitizeUrlPath } from "./logger";

/**
 * Options for logRouteError
 */
interface LogRouteErrorOptions {
  /** The Hono context (provides req, res) */
  c: Context;
  /** The caught error */
  error: unknown;
  /** Optional additional metadata */
  meta?: Record<string, unknown>;
  /**
   * Custom message. Defaults to:
   * "[METHOD] /path → ERROR: message"
   */
  message?: string;
}

/**
 * Consistent route error logging helper for the API.
 *
 * Logs the error at ERROR level with:
 * - HTTP method + sanitized path (no query params)
 * - HTTP status code (from c.status)
 * - `type: "route_error"` marker
 * - error message, code, and stack (in dev)
 * - any extra meta passed by caller
 *
 * Pino argument order: meta FIRST, message SECOND
 */
export function logRouteError(
  logger: pino.Logger,
  opts: LogRouteErrorOptions,
): void {
  const { c, error, meta } = opts;
  const req = c.req;

  const method = req.method;
  const path = sanitizeUrlPath(req.url);
  const status = c.status;

  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error ? error.stack : undefined;
  const errorCode =
    error && typeof error === "object"
      ? (error as { code?: string }).code
      : undefined;

  const logMeta: Record<string, unknown> = {
    type: "route_error",
    method,
    path,
    status,
    ...(errorCode && { errorCode }),
    ...meta,
  };

  // In development, also attach the stack trace
  if (process.env.NODE_ENV === "development" && errorStack) {
    logMeta.stack = errorStack;
  }

  logger.error(logMeta, `[${method}] ${path} → ${status}: ${errorMessage}`);
}