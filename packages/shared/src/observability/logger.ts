import winston from "winston";

export interface LoggerOptions {
  appName: string;
  logLevel?: string;
  logDir?: string;
}

export function createLogger(options: LoggerOptions) {
  const { appName, logLevel = "info", logDir } = options;

  const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    }),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({ format: consoleFormat }),
  ];

  if (logDir) {
    transports.push(
      new winston.transports.File({
        filename: `${logDir}/error.log`,
        level: "error",
        format: jsonFormat,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: `${logDir}/combined.log`,
        format: jsonFormat,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    );
  }

  return winston.createLogger({
    level: logLevel,
    transports,
    exceptionHandlers: logDir ? [
      new winston.transports.File({
        filename: `${logDir}/exceptions.log`,
        format: jsonFormat,
      }),
    ] : [],
    rejectionHandlers: logDir ? [
      new winston.transports.File({
        filename: `${logDir}/rejections.log`,
        format: jsonFormat,
      }),
    ] : [],
  });
}

// Child logger helper — adds persistent metadata to all log calls
export function createChildLogger(parent: winston.Logger, meta: Record<string, unknown>) {
  return parent.child(meta);
}