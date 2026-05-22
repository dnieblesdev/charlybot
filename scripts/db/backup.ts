/**
 * Database Backup Module
 * 
 * Provides core backup functionality for SQLite and PostgreSQL databases.
 * - SQLite: uses file copy for atomic, crash-safe copies
 * - PostgreSQL: uses pg_dump for SQL dumps (optionally compressed with gzip)
 */

import { mkdir, readdir, stat, unlink, copyFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import { detectProvider, getBackupDir, isPostgreSQL } from "./provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface BackupOptions {
  type: "daily" | "migration";
  customPath?: string;
  compress?: boolean;  // PostgreSQL only: gzip the output
}

export interface BackupResult {
  filename: string;
  filepath: string;
  sizeBytes: number;
  timestamp: Date;
  provider: "postgresql" | "sqlite";
  format: "sql" | "sql.gz" | "db";
}

/**
 * Generate timestamp in ISO 8601 format without dashes for filesystem compatibility
 */
export function generateTimestamp(): string {
  const now = new Date();
  const parts = now.toISOString().replace(/[-:]/g, "").replace("T", "_").split(".");
  return parts[0] ?? "";
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(provider: "postgresql" | "sqlite"): Promise<string> {
  const backupDir = getBackupDir();
  try {
    await mkdir(backupDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  return backupDir;
}

/**
 * Create a backup of the SQLite database
 * Uses file copy for atomic, crash-safe operation
 */
async function createSQLiteBackup(
  dbPath: string,
  backupDir: string,
  type: "daily" | "migration"
): Promise<BackupResult> {
  const timestamp = generateTimestamp();
  const filename = `${timestamp}_${type}_backup.db`;
  const filepath = join(backupDir, filename);

  // Verify source DB exists
  try {
    await stat(dbPath);
  } catch {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  // Copy database file to backup location
  await copyFile(dbPath, filepath);

  // Get file size
  const stats = await stat(filepath);

  console.log(`✅ Backup created: ${filename}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Location: ${filepath}`);

  return {
    filename,
    filepath,
    sizeBytes: stats.size,
    timestamp: new Date(),
    provider: "sqlite",
    format: "db",
  };
}

/**
 * Execute pg_dump and stream output to a file
 */
async function runPgDump(
  databaseUrl: string,
  outputFile: string,
  compress: boolean
): Promise<void> {
  // Build pg_dump arguments (args array — no shell injection risk)
  const pgDumpArgs = [
    "--format=plain",
    "--no-owner",
    "--no-acl",
  ];

  // For pg_dump, the connection string is passed via --dbname or as positional arg
  // Use --dbname option to avoid splitting on special chars in the URL
  const urlObj = new URL(databaseUrl);
  pgDumpArgs.push(`--dbname=${databaseUrl}`);

  if (compress) {
    // pg_dump stdout → gzip → file
    const gzip = createGzip();
    const fileHandle = await createWriteStream(outputFile);

    await new Promise<void>((resolve, reject) => {
      const pgDump = spawn("pg_dump", pgDumpArgs, {
        env: { ...process.env }, // Don't clear PGDATABASE — let connection string take precedence
        stdio: ["ignore", "pipe", "pipe"],
      });

      pgDump.on("error", (error: any) => {
        if (error.code === "ENOENT") {
          reject(new Error(
            "❌ pg_dump not found. Install PostgreSQL client tools:\n" +
            "  macOS: brew install postgresql\n" +
            "  Ubuntu/Debian: apt-get install postgresql-client\n" +
            "  Windows: download from postgresql.org or use chocolatey: choco install postgresql"
          ));
        } else {
          reject(new Error(`❌ pg_dump failed: ${error.message}`));
        }
      });

      pgDump.stderr.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes("connection")) {
          reject(new Error(`❌ PostgreSQL connection failed: ${msg}`));
        }
      });

      pgDump.on("close", (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`❌ pg_dump exited with code ${code}`));
        }
      });

      // Pipeline: pg_dump stdout → gzip → file
      pipeline(pgDump.stdout, gzip, fileHandle)
        .then(() => {
          fileHandle.close();
          resolve();
        })
        .catch(reject);
    });
  } else {
    // Direct write to file — pg_dump stdout → file
    const fileHandle = await createWriteStream(outputFile);

    await new Promise<void>((resolve, reject) => {
      const pgDump = spawn("pg_dump", pgDumpArgs, {
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      pgDump.on("error", (error: any) => {
        if (error.code === "ENOENT") {
          reject(new Error(
            "❌ pg_dump not found. Install PostgreSQL client tools:\n" +
            "  macOS: brew install postgresql\n" +
            "  Ubuntu/Debian: apt-get install postgresql-client\n" +
            "  Windows: download from postgresql.org or use chocolatey: choco install postgresql"
          ));
        } else {
          reject(new Error(`❌ pg_dump failed: ${error.message}`));
        }
      });

      pgDump.stderr.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes("connection")) {
          reject(new Error(`❌ PostgreSQL connection failed: ${msg}`));
        }
      });

      pgDump.on("close", (code: number | null) => {
        if (code !== 0) {
          reject(new Error(`❌ pg_dump exited with code ${code}`));
        }
      });

      pipeline(pgDump.stdout, fileHandle)
        .then(() => {
          fileHandle.close();
          resolve();
        })
        .catch(reject);
    });
  }
}

/**
 * Create a backup of the PostgreSQL database using pg_dump
 */
async function createPostgresBackup(
  databaseUrl: string,
  backupDir: string,
  type: "daily" | "migration",
  compress: boolean = false
): Promise<BackupResult> {
  const timestamp = generateTimestamp();
  const ext = compress ? ".sql.gz" : ".sql";
  const filename = `${timestamp}_${type}_backup${ext}`;
  const filepath = join(backupDir, filename);

  console.log(`📦 Creating PostgreSQL backup...`);
  if (compress) {
    console.log(`   Compression: enabled (gzip)`);
  }

  await runPgDump(databaseUrl, filepath, compress);

  // Get file size
  const stats = await stat(filepath);

  console.log(`✅ Backup created: ${filename}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Location: ${filepath}`);

  return {
    filename,
    filepath,
    sizeBytes: stats.size,
    timestamp: new Date(),
    provider: "postgresql",
    format: compress ? "sql.gz" : "sql",
  };
}

/**
 * Create a backup of the database (auto-detects provider)
 */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  const provider = detectProvider();
  const backupDir = await ensureBackupDir(provider);

  // Get database path or URL based on provider
  const dbUrl = process.env.DATABASE_URL;

  if (provider === "postgresql") {
    if (!dbUrl) {
      throw new Error(
        "DATABASE_URL is required for PostgreSQL backups.\n" +
        "  Set: postgresql://user:password@host:port/dbname"
      );
    }
    return createPostgresBackup(dbUrl, backupDir, options.type, options.compress ?? false);
  } else {
    // SQLite: use the file path from DATABASE_URL or default
    const dbPath = dbUrl 
      ? dbUrl.replace(/^file:/, "") 
      : join(__dirname, "../../packages/shared/dev.db");
    
    return createSQLiteBackup(dbPath, backupDir, options.type);
  }
}

/**
 * List all available backups in the backup directory for current provider
 */
export async function listBackups(): Promise<BackupResult[]> {
  const provider = detectProvider();
  const backupDir = getBackupDir();

  // Ensure backup dir exists
  try {
    await mkdir(backupDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  const files = await readdir(backupDir);
  const backups: BackupResult[] = [];

  for (const file of files) {
    // Filter by provider-specific extensions
    let matches = false;
    let format: "sql" | "sql.gz" | "db" = "db";
    
    if (provider === "postgresql") {
      matches = file.endsWith("_backup.sql") || file.endsWith("_backup.sql.gz");
      format = file.endsWith(".sql.gz") ? "sql.gz" : "sql";
    } else {
      matches = file.endsWith("_backup.db");
      format = "db";
    }
    
    if (!matches) continue;

    const filepath = join(backupDir, file);
    const stats = await stat(filepath);

    // Parse timestamp from filename: 20260329_143022_daily_backup.db
    const match = file.match(/^(\d{8}_\d{6})_(\w+)_backup(?:\.(sql|sql\.gz))?$/);
    const timestamp = match && match[1]
      ? new Date(`${match[1].replace("_", "T")}`)
      : stats.mtime;

    backups.push({
      filename: file,
      filepath,
      sizeBytes: stats.size,
      timestamp,
      provider,
      format,
    });
  }

  // Sort by timestamp descending (newest first)
  backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return backups;
}

/**
 * Get the latest backup of a specific type
 */
export async function getLatestBackup(type?: "daily" | "migration"): Promise<BackupResult | null> {
  const backups = await listBackups();
  
  if (type) {
    const filtered = backups.filter(b => b.filename.includes(`_${type}_`));
    return filtered[0] || null;
  }

  return backups[0] || null;
}

// CLI execution
if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "create": {
        const type = (args[1] as "daily" | "migration") || "daily";
        const compress = args.includes("--compress");
        
        if (isPostgreSQL() && !compress) {
          console.log(`\n💡 Tip: Use --compress flag to gzip PostgreSQL backups:\n   pnpm db:backup create ${type} --compress\n`);
        }
        
        await createBackup({ type, compress });
        break;
      }
      case "list": {
        const backups = await listBackups();
        const provider = detectProvider();
        
        console.log(`\n📦 Available backups (${provider}):\n`);
        
        if (backups.length === 0) {
          console.log("   No backups found.\n");
        }
        
        for (const backup of backups) {
          const date = backup.timestamp.toLocaleString();
          const size = (backup.sizeBytes / 1024).toFixed(2);
          console.log(`  ${backup.filename}`);
          console.log(`    ${date} | ${size} KB | ${backup.format}\n`);
        }
        break;
      }
      case "latest": {
        const backup = await getLatestBackup();
        if (backup) {
          console.log(backup.filepath);
        } else {
          console.error("No backups found");
          process.exit(1);
        }
        break;
      }
      default:
        console.log("Usage:");
        console.log("  pnpm db:backup create [daily|migration] [--compress]");
        console.log("  pnpm db:backup list");
        console.log("  pnpm db:backup latest");
    }
  })();
}