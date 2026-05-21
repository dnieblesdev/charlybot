/**
 * Database Provider Detection Utilities
 * 
 * Detects whether we're using PostgreSQL or SQLite based on the DATABASE_URL.
 * Shared across all DB scripts (backup, restore, migrate, rotate).
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Database provider type */
export type Provider = "postgresql" | "sqlite";

/**
 * Detect the database provider from DATABASE_URL
 * 
 * PostgreSQL URLs start with postgresql:// or postgres://
 * Everything else (file:, libsql:, relative paths) is treated as SQLite
 */
export function detectProvider(databaseUrl?: string): Provider {
  const url = databaseUrl ?? process.env.DATABASE_URL ?? "";
  
  // PostgreSQL detection: both postgresql:// and postgres:// schemes
  if (/^postgres(ql)?:\/\//.test(url)) {
    return "postgresql";
  }
  
  return "sqlite";
}

/** Shorthand: is the provider PostgreSQL? */
export function isPostgreSQL(databaseUrl?: string): boolean {
  return detectProvider(databaseUrl) === "postgresql";
}

/** Shorthand: is the provider SQLite? */
export function isSQLite(databaseUrl?: string): boolean {
  return detectProvider(databaseUrl) === "sqlite";
}

/**
 * Get the backup directory path for the current provider
 * 
 * PostgreSQL → backups/postgres/
 * SQLite → backups/sqlite/
 */
export function getBackupDir(databaseUrl?: string): string {
  const provider = detectProvider(databaseUrl);
  
  if (provider === "postgresql") {
    return join(__dirname, "../../backups/postgres");
  }
  
  return join(__dirname, "../../backups/sqlite");
}

/**
 * Get the backup directory path for a specific provider
 */
export function getBackupDirForProvider(provider: Provider): string {
  if (provider === "postgresql") {
    return join(__dirname, "../../backups/postgres");
  }
  
  return join(__dirname, "../../backups/sqlite");
}

/**
 * Require DATABASE_URL to be set for PostgreSQL
 * Throws if not set or if using SQLite (no-op for SQLite)
 */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it to:\n" +
      "  PostgreSQL: postgresql://user:password@host:port/dbname\n" +
      "  SQLite: file:./path/to/db.db"
    );
  }
  return url;
}

/**
 * Get DATABASE_URL, throwing if not set
 */
export function getDatabaseUrl(): string {
  return requireDatabaseUrl();
}