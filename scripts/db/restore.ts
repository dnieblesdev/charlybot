/**
 * Database Restore Module
 * 
 * Provides restoration functionality from backup files.
 * - SQLite: copies .db file to target path
 * - PostgreSQL: uses psql to restore from .sql or decompresses .sql.gz via gunzip
 */

import { existsSync } from "node:fs";
import { copyFile, stat, unlink, createReadStream } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import { detectProvider, getBackupDir } from "./provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RestoreOptions {
  backupFilename: string | "latest";
  force?: boolean;  // Skip confirmation
}

/**
 * Get database path from DATABASE_URL for SQLite
 */
function getSQLiteDbPath(): string {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.startsWith("file:")) {
    return dbUrl.replace(/^file:/, "");
  }
  return join(__dirname, "../../packages/shared/dev.db");
}

/**
 * Restore SQLite database from backup (async)
 */
async function restoreSQLite(backupPath: string, force: boolean): Promise<boolean> {
  const dbPath = getSQLiteDbPath();

  // Confirm restoration
  if (!force) {
    console.log("\n⚠️  WARNING: This will replace the current database!");
    console.log(`   Backup: ${backupPath}`);
    console.log(`   Target: ${dbPath}`);
    console.log("\n   To proceed, run with --force flag or delete the current database first.\n");
    
    if (existsSync(dbPath)) {
      console.log("❌ Restore aborted. Delete the current database first or use --force.\n");
      return false;
    }
  }

  console.log("🔄 Restoring SQLite database...\n");
  
  try {
    // If current DB exists, create corrupt backup before replacing
    if (existsSync(dbPath)) {
      const corruptBackup = `${dbPath}.corrupt.${Date.now()}`;
      await copyFile(dbPath, corruptBackup);
      console.log(`📦 Current DB backed up to: ${corruptBackup}`);
      await unlink(dbPath);
    }

    // Copy backup to main DB location (async)
    await copyFile(backupPath, dbPath);
    
    console.log("✅ Database restored successfully!");
    console.log(`   From: ${backupPath}`);
    console.log(`   To: ${dbPath}\n`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ Restore failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if psql is available
 */
async function checkPsql(): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const psql = spawn("psql", ["--version"], { stdio: "pipe" });
      psql.on("error", () => reject(new Error("not found")));
      psql.on("close", (code) => (code === 0 ? resolve() : reject(new Error("not found"))));
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restore PostgreSQL database from SQL backup
 */
async function restorePostgreSQL(backupPath: string, force: boolean): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is required for PostgreSQL restore.");
    console.log("   Set: postgresql://user:password@host:port/dbname");
    return false;
  }

  if (!force) {
    console.log("\n⚠️  WARNING: This will replace the current database!");
    console.log(`   Backup: ${backupPath}`);
    console.log(`   Target: PostgreSQL at ${databaseUrl.split("@")[1] ?? "unknown"}`);
    console.log("\n   To proceed, run with --force flag.\n");
    return false;
  }

  // Check for psql
  const psqlAvailable = await checkPsql();
  if (!psqlAvailable) {
    console.error(
      "❌ psql not found. Install PostgreSQL client tools:\n" +
      "  macOS: brew install postgresql\n" +
      "  Ubuntu/Debian: apt-get install postgresql-client\n" +
      "  Windows: download from postgresql.org or use chocolatey: choco install postgresql"
    );
    return false;
  }

  console.log("🔄 Restoring PostgreSQL database...\n");

  try {
    if (backupPath.endsWith(".sql.gz")) {
      // Decompress with Node.js zlib and pipe to psql stdin
      console.log("📦 Decompressing .sql.gz...\n");
      
      const psqlProcess = spawn("psql", [databaseUrl], {
        stdio: ["pipe", "inherit", "pipe"],
      });

      const gunzip = createGunzip();
      const fileStream = createReadStream(backupPath);
      
      // Handle psql stderr
      psqlProcess.stderr.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes("connection")) {
          console.error(`❌ PostgreSQL connection failed: ${msg}`);
        }
      });

      // Pipeline: file → gunzip → psql stdin
      await pipeline(
        fileStream,
        gunzip,
        psqlProcess.stdin!
      );

      const exitCode = await new Promise<number>((resolve) => {
        psqlProcess.on("close", (code) => resolve(code ?? 1));
      });

      if (exitCode !== 0) {
        console.error(`❌ Restore failed: psql exited with code ${exitCode}`);
        return false;
      }
    } else {
      // Direct psql restore with file argument
      const psqlProcess = spawn("psql", [databaseUrl, "-f", backupPath], {
        stdio: "inherit",
      });

      const exitCode = await new Promise<number>((resolve) => {
        psqlProcess.on("close", (code) => resolve(code ?? 1));
      });

      if (exitCode !== 0) {
        console.error(`❌ Restore failed: psql exited with code ${exitCode}`);
        return false;
      }
    }
    
    console.log("✅ Database restored successfully!");
    console.log(`   From: ${backupPath}\n`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ Restore failed: ${error.message}`);
    return false;
  }
}

/**
 * Restore database from backup (auto-detects provider)
 */
export async function restore(options: RestoreOptions): Promise<boolean> {
  const { backupFilename, force } = options;
  const provider = detectProvider();
  const backupDir = getBackupDir();
  
  // Get latest backup if requested
  let backupPath: string | null;
  
  if (backupFilename === "latest") {
    const { getLatestBackup } = await import("./backup.js");
    const latest = await getLatestBackup();
    
    if (!latest) {
      console.error("❌ No backups found");
      return false;
    }
    
    backupPath = latest.filepath;
    console.log(`📦 Using latest backup: ${latest.filename}`);
  } else {
    backupPath = join(backupDir, backupFilename);
    
    if (!existsSync(backupPath)) {
      console.error(`❌ Backup not found: ${backupFilename}`);
      console.log("\n📋 Available backups:");
      const { listBackups } = await import("./backup.js");
      const backups = await listBackups();
      for (const b of backups) {
        console.log(`   - ${b.filename}`);
      }
      return false;
    }
  }

  // Route to provider-specific restore
  if (provider === "postgresql") {
    return restorePostgreSQL(backupPath!, force);
  } else {
    return restoreSQLite(backupPath!, force);
  }
}

/**
 * List available backups with restore options
 */
export async function listRestoreOptions(): Promise<void> {
  const { listBackups } = await import("./backup.js");
  const backups = await listBackups();
  const provider = detectProvider();
  
  console.log(`\n📦 Available Backups for Restore (${provider}):\n`);
  
  if (backups.length === 0) {
    console.log("   No backups found.\n");
    return;
  }
  
  for (const backup of backups) {
    const date = backup.timestamp.toLocaleString();
    const size = (backup.sizeBytes / 1024).toFixed(2);
    console.log(`   ${backup.filename}`);
    console.log(`     ${date} | ${size} KB | ${backup.format}`);
    console.log(`     pnpm db:restore ${backup.filename}\n`);
  }
  
  console.log("   Quick restore latest:");
  console.log("   pnpm db:restore latest\n");
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  
  // Parse flags
  const force = args.includes("--force") || args.includes("-f");
  const filteredArgs = args.filter(a => !a.startsWith("-"));
  
  const backupName = filteredArgs[0] || "latest";

  if (backupName === "list" || backupName === "available") {
    listRestoreOptions().then(() => process.exit(0));
  } else {
    restore({ 
      backupFilename: backupName as string,
      force,
    }).then(success => {
      process.exit(success ? 0 : 1);
    });
  }
}