import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = "***";
    return u.toString();
  } catch {
    // Fallback: regex replace user:pass@ or user@ patterns
    return url.replace(/^(\w+:\/\/[^:@]+)(?::[^@]+)?@/, "$1:***@");
  }
}

/**
 * Lazy initialization: prisma client is created on first access.
 * This prevents module import errors when DATABASE_URL is not set,
 * allowing builds/tests/CLI that import @charlybot/shared without needing DB.
 */
let prismaInstance: PrismaClient | undefined;
let adapterInstance: PrismaPg | undefined;

/**
 * Get or create the Prisma client instance.
 * Deferred until first called to avoid throwing at import time.
 */
export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        'DATABASE_URL is required for PostgreSQL. Set it to postgresql://user:password@host:port/dbname'
      );
    }
    if (!/^postgres(ql)?:\/\//.test(url)) {
      throw new Error(
        `DATABASE_URL must start with postgresql:// or postgres:// (got: "${redactUrl(url)}")`
      );
    }
    const pool = new Pool({ connectionString: url });
    adapterInstance = new PrismaPg(pool);
    prismaInstance = new PrismaClient({
      adapter: adapterInstance,
      log: getLogLevel(),
    });
  }
  return prismaInstance;
}

/**
 * Backward-compatible prisma export — resolves lazily to avoid import-time errors.
 * Use getPrisma() for explicit control.
 */
const INSPECT_SYMBOLS = [
  Symbol.for("nodejs.util.inspect.custom"),
  Symbol.toStringTag,
  Symbol.iterator,
  "then",
  "constructor",
  "toString",
  "valueOf",
];

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    // Avoid initializing Prisma during inspection/introspection
    if (typeof prop === "symbol" || INSPECT_SYMBOLS.includes(prop as string)) {
      return undefined;
    }
    const instance = getPrisma();
    const value = (instance as any)[prop];
    // Bind functions so `this` stays on the real PrismaClient instance
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

/**
 * Determine log level based on environment.
 * 
 * WARNING: Setting 'query' log level in development can leak sensitive data
 * (tokens, emails, PII) into logs. Only enable via PRISMA_LOG_QUERIES=1 env var.
 */
function getLogLevel(): ('error' | 'warn' | 'query')[] {
  if (['1', 'true'].includes(process.env.PRISMA_LOG_QUERIES?.toLowerCase() ?? '')) {
    return ['error', 'warn', 'query'];
  }
  return ['error', 'warn'];
}

// Re-export all generated Prisma types and client
export * from './generated/prisma';
