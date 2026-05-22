import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

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
    adapterInstance = new PrismaPg({ connectionString: url });
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
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop];
  },
});

/**
 * Determine log level based on environment.
 * 
 * WARNING: Setting 'query' log level in development can leak sensitive data
 * (tokens, emails, PII) into logs. Only enable via PRISMA_LOG_QUERIES=1 env var.
 */
function getLogLevel(): ('error' | 'warn' | 'query')[] {
  if (process.env.PRISMA_LOG_QUERIES === '1') {
    return ['error', 'warn', 'query'];
  }
  return ['error', 'warn'];
}

// Re-export all generated Prisma types and client
export * from './generated/prisma';