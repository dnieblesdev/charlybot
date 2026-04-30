import { createLogger, createChildLogger } from "@charlybot/shared";

/**
 * Sanitize URL path - log path only, strip query string
 * Masks sensitive query parameters
 */
function sanitizeUrlPath(rawUrl: string): string {
  try {
    // Handle full URLs like http://localhost:3000/api/v1/xp?limit=100
    if (rawUrl.includes('://')) {
      const url = new URL(rawUrl);
      return url.pathname;
    }

    // Handle path-only URLs like /api/v1/xp?limit=100
    // Strip query string entirely - don't log any query params
    return rawUrl.split('?')[0] ?? rawUrl;
  } catch {
    // On parse error, still strip querystring
    return rawUrl.split('?')[0] ?? rawUrl;
  }
}

const logger = createLogger({
  appName: "api",
  logLevel: process.env.LOG_LEVEL || "info",
  logDir: "apps/api/logs",
});

// Re-export child logger helper for middleware/services
export { createChildLogger };

// Export utility for middleware
export { sanitizeUrlPath };

export default logger;