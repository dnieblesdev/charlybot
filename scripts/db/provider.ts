/**
 * Database Provider Detection Utilities
 * 
 * Detects whether we're using PostgreSQL based on the DATABASE_URL.
 * Shared across all DB scripts (backup, restore, migrate, rotate).
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Database provider type */
export type Provider = "postgresql";

/**
 * Detect the database provider from DATABASE_URL
 * 
 * PostgreSQL URLs start with postgresql:// or postgres://
 */
export function detectProvider(databaseUrl?: string): Provider {
  const url = databaseUrl ?? process.env.DATABASE_URL ?? "";
  
  // Empty URL — throw for explicit configuration (matches getPrisma() behavior)
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it to:\n" +
      "  PostgreSQL: postgresql://user:password@host:port/dbname"
    );
  }
  
  // PostgreSQL detection: both postgresql:// and postgres:// schemes
  if (/^postgres(ql)?:\/\//.test(url)) {
    return "postgresql";
  }
  
  // Unrecognizable URL — throw with guidance (password always redacted)
  throw new Error(
    `Unrecognizable DATABASE_URL: "${redactUrl(url)}".\n` +
    "Expected formats:\n" +
    "  PostgreSQL: postgresql://user:password@host:port/dbname"
  );
}

/** Shorthand: is the provider PostgreSQL? */
export function isPostgreSQL(databaseUrl?: string): boolean {
  return detectProvider(databaseUrl) === "postgresql";
}

/**
 * Get the backup directory path for the current provider
 * 
 * PostgreSQL → backups/postgres/
 */
export function getBackupDir(databaseUrl?: string): string {
  const provider = detectProvider(databaseUrl);
  return getBackupDirForProvider(provider);
}

/**
 * Get the backup directory path for a specific provider
 */
export function getBackupDirForProvider(provider: Provider): string {
  if (provider !== "postgresql") {
    // Provider is a literal type, but keep runtime guard for safety.
    throw new Error(`Unsupported provider: ${String(provider)}`);
  }
  return join(__dirname, "../../backups/postgres");
}

/**
 * Parse a PostgreSQL connection string and return credential components.
 * Returns null if the URL is not a valid PostgreSQL URL.
 * WARNING: returned object contains the raw password — do not log it.
 */
export function parsePostgresUrl(databaseUrl: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  safeUrl: string;
} | null {
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      return null;
    }
    const safeUrl = `${url.protocol}//${url.username}:***@${url.host}${url.pathname}`;
    return {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      safeUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Build env vars for pg_dump/psql from a PostgreSQL connection string.
 * Avoids putting credentials in argv (process listing leak).
 */
export function getPgEnvVars(databaseUrl: string): Record<string, string> {
  const parsed = parsePostgresUrl(databaseUrl);
  if (!parsed) {
    throw new Error(`Invalid PostgreSQL connection string: ${redactUrl(databaseUrl)}`);
  }
  // Pass the FULL DATABASE_URL so query params (sslmode, schema, etc.) are preserved.
  // pg_dump/psql respect DATABASE_URL when no explicit PGHOST/PGPORT/PGUSER/PGDATABASE
  // vars are set. We only set PGPASSWORD separately to avoid argv credential leak.
  return {
    DATABASE_URL: databaseUrl,
    PGPASSWORD: parsed.password,
  };
}

/**
 * Redact password from any URL string for safe logging.
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = "***";
    return u.toString();
  } catch {
    // Fallback: regex replace user:pass@ pattern
    return url.replace(/^(\w+:\/\/[^:@]+):[^@]+@/, "$1:***@");
  }
}

/**
 * Require DATABASE_URL to be set for PostgreSQL
 * Throws if not set
 */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Set it to:\n" +
      "  PostgreSQL: postgresql://user:password@host:port/dbname"
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
