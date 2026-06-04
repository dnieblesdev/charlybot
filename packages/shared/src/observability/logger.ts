import pino from "pino";
import { createRequire } from "node:module";

// =============================================================================
// Types
// =============================================================================

export interface LoggerOptions {
  appName: string;
  logLevel?: string;
  logDir?: string;
}

// =============================================================================
// Version resolution
// =============================================================================

function getVersion(): string {
  return process.env.VERSION || process.env.npm_package_version || "0.0.0";
}

// =============================================================================
// Expose pino stdSerializers (for consumers)
// =============================================================================

export const stdSerializers = pino.stdSerializers;

// =============================================================================
// Compatibility layer (Winston-style call sites)
// =============================================================================

// This repo historically logged like Winston: logger.info("msg", { meta })
// Pino expects meta first: logger.info({ meta }, "msg")
//
// We keep call sites working *and* preserve structured logging by swapping
// args at runtime when we detect the old pattern.
const COMPAT_LOGGER = Symbol.for("@charlybot/compat-logger");

type CompatLogFn = pino.LogFn &
  ((msg: string, meta: Record<string, unknown>) => void) &
  ((msg: string, err: Error) => void) &
  ((msg: string, value: unknown) => void);

export type CompatLogger = pino.Logger & {
  trace: CompatLogFn;
  debug: CompatLogFn;
  info: CompatLogFn;
  warn: CompatLogFn;
  error: CompatLogFn;
  fatal: CompatLogFn;
};

function toCompatLogger(logger: pino.Logger): CompatLogger {
  const anyLogger = logger as any;
  if (anyLogger[COMPAT_LOGGER]) return logger as CompatLogger;
  anyLogger[COMPAT_LOGGER] = true;

  const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

  for (const level of levels) {
    const original = logger[level].bind(logger) as (...args: any[]) => void;
    (anyLogger[level] as unknown) = ((...args: any[]) => {
      // Winston pattern: (message: string, meta: object)
      if (typeof args[0] === "string" && args.length >= 2) {
        const second = args[1];

        // (message, Error) → ({ err }, message)
        if (second instanceof Error) {
          return original({ err: second }, args[0], ...args.slice(2));
        }

        // (message, { ...meta }) → ({ ...meta }, message)
        if (second && typeof second === "object" && !Array.isArray(second)) {
          return original(second, args[0], ...args.slice(2));
        }

        // (message, unknown) → ({ value }, message)
        // Keeps legacy `catch (error) { logger.error("...", error) }` calls
        // type-safe even when TypeScript correctly types catch values as unknown.
        return original({ value: second }, args[0], ...args.slice(2));
      }

      return original(...args);
    }) as CompatLogFn;
  }

  // Ensure child loggers are also compat-wrapped
  const originalChild = (
    logger.child as unknown as (...args: any[]) => pino.Logger
  ).bind(logger);
  anyLogger.child = (...args: any[]) => toCompatLogger(originalChild(...args));

  return logger as CompatLogger;
}

// =============================================================================
// Factory
// =============================================================================

const IS_DEV = process.env.NODE_ENV !== "production";

const require = createRequire(import.meta.url);

function createPrettyDestination() {
  try {
    const pretty = require("pino-pretty") as (opts?: any) => any;
    return pretty({
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    });
  } catch {
    return undefined;
  }
}

export function createLogger(options: LoggerOptions): CompatLogger {
  const { appName, logLevel, logDir } = options;
  const level = logLevel ?? process.env.LOG_LEVEL ?? "info";
  const version = getVersion();

  // Build base fields — inherited by every log line
  const base = {
    service: appName,
    environment: process.env.NODE_ENV ?? "development",
    version,
  };

  // Output strategy
  // - Dev: prefer in-process pino-pretty (no worker transports) to avoid
  //   "silent logs" issues under tsx/docker/pnpm layouts.
  // - Prod + logDir: rotate file via pino-roll transport and keep stdout JSON.
  const destination = (() => {
    if (IS_DEV) {
      return createPrettyDestination();
    }

    if (logDir) {
      try {
        const targets = [
          {
            target: "pino-roll",
            options: {
              file: `${logDir}/combined.log`,
              size: "10m",
              interval: "1d",
              maxFiles: 7,
              compress: "gzip",
              mkdir: true,
            },
          },
          {
            // stdout JSON (destination 1)
            target: "pino/file",
            options: {
              destination: 1,
            },
          },
        ];

        return pino.transport({ targets } as any);
      } catch {
        return undefined;
      }
    }

    return undefined;
  })();

  const logger = destination
    ? pino(
        {
          level,
          base,
          formatters: {
            level: (label) => ({ level: label }),
          },
          timestamp: pino.stdTimeFunctions.isoTime,
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.headers['x-api-key']",
              "*.password",
              "*.token",
              "*.secret",
              "*.apiKey",
              "body.Authorization",
              "body.cookie",
            ],
            censor: "[REDACTED]",
          },
        },
        destination
      )
    : pino({
        level,
        base,
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.headers['x-api-key']",
            "*.password",
            "*.token",
            "*.secret",
            "*.apiKey",
            "body.Authorization",
            "body.cookie",
          ],
          censor: "[REDACTED]",
        },
      });

  const compatLogger = toCompatLogger(logger);

  // Register global exception/rejection handlers once per process
  // (no-op if already registered by another logger instance)
  registerProcessHandlers(compatLogger);

  return compatLogger;
}

// =============================================================================
// Child logger helper
// =============================================================================

export function createChildLogger(
  parent: pino.Logger,
  meta: Record<string, unknown>
): CompatLogger {
  return toCompatLogger(parent.child(meta));
}

// =============================================================================
// Process exception handlers (once per process)
// Skip in test env — vitest manages process lifecycle
// =============================================================================

let handlersRegistered = false;

function registerProcessHandlers(logger: pino.Logger) {
  if (handlersRegistered) return;
  // Never register in test — vitest controls process exit
  if (process.env.NODE_ENV === "test") return;
  handlersRegistered = true;

  process.on("uncaughtException", (err: Error, origin: string) => {
    logger.fatal(
      {
        err: { message: err.message, stack: err.stack, name: err.name },
        origin,
      },
      "Uncaught exception — process will exit"
    );
    setTimeout(() => process.exit(1), 1000);
  });

  process.on(
    "unhandledRejection",
    (reason: unknown, _promise: Promise<unknown>) => {
      logger.error(
        {
          reason: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
        },
        "Unhandled promise rejection"
      );
    }
  );
}
