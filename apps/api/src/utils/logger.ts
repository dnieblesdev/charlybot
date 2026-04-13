import winston from "winston";

// Sensitive field names to redact
const SENSITIVE_FIELDS = ['apiKey', 'token', 'auth', 'password', 'secret', 'credential', 'authorization'];
const MAX_META_SIZE = 10000; // 10KB max for meta object

/**
 * Safely serialize meta object to JSON string
 * - Redacts sensitive fields
 * - Truncates large objects
 * - Handles circular references
 */
function safeStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return '';
  }

  // Handle primitives
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  // Deep clone with redaction and truncation
  const REDACT = '[REDACTED]';
  const MAX_DEPTH = 5;
  const MAX_PROPS = 50;

  function sanitize(value: unknown, depth: number): unknown {
    if (depth > MAX_DEPTH) {
      return '[MAX_DEPTH]';
    }

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      if (value.length > MAX_PROPS) {
        return `[${value.length} items]`;
      }
      return value.map(item => sanitize(item, depth + 1));
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > MAX_PROPS) {
        return `[${entries.length} props]`;
      }

      const result: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        const lowerKey = k.toLowerCase();
        if (SENSITIVE_FIELDS.some(sf => lowerKey.includes(sf))) {
          result[k] = REDACT;
        } else {
          result[k] = sanitize(v, depth + 1);
        }
      }
      return result;
    }

    return String(value);
  }

  try {
    const sanitized = sanitize(obj, 0);
    const json = JSON.stringify(sanitized);
    
    // Truncate if too large
    if (json.length > MAX_META_SIZE) {
      return json.substring(0, MAX_META_SIZE) + '...[TRUNCATED]';
    }
    
    return json;
  } catch {
    return '[UNSTRINGABLE]';
  }
}

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
    const [path] = rawUrl.split('?');
    return path;
  } catch {
    // On parse error, still strip querystring
    const [path] = rawUrl.split('?');
    return path;
  }
}

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "blue",
  },
};

winston.addColors(customLevels.colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      // Use safe-stringify instead of raw JSON.stringify
      msg += ` ${safeStringify(meta)}`;
    }
    return msg;
  })
);

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || "info",
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Export sanitization helpers for use in middleware
export { safeStringify, sanitizeUrlPath, SENSITIVE_FIELDS };

export default logger;
