/**
 * Database Restore Module
 * 
 * Provides restoration functionality from backup files.
 * - PostgreSQL: uses psql to restore from .sql or decompresses .sql.gz via gunzip
 *
 * Note (PostgreSQL): our backup defaults use pg_dump with --no-owner --no-acl for DEV safety.
 * That means restores won't recreate ownership/GRANTs. For environments where ACLs matter,
 * create the dump with `pnpm db:backup create ... --preserve-acl` (or PRESERVE_ACL=true).
 */

import { existsSync, createReadStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import { getBackupDirForProvider, getPgEnvVars, redactUrl } from "./provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RestoreOptions {
  backupFilename: string | "latest";
  force?: boolean;  // Skip confirmation
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
    console.log(`   Target: PostgreSQL at ${redactUrl(databaseUrl)}`);
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
      
      const pgEnv = getPgEnvVars(databaseUrl);
      const psqlArgs = ["-v", "ON_ERROR_STOP=1", "-1"]; // stop on SQL errors, restore in a single transaction
      const psqlProcess = spawn("psql", psqlArgs, {
        env: { ...process.env, ...pgEnv },
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

      // Guard: stdin may be null if spawn fails early
      if (!psqlProcess.stdin) {
        throw new Error("❌ psql stdin unavailable (spawn failed)");
      }

      // Pipeline: file → gunzip → psql stdin
      const pipePromise = pipeline(fileStream, gunzip, psqlProcess.stdin);

      // Wait for pipeline, then process exit — sequential avoids race conditions
      try {
        await pipePromise;
      } catch (err: any) {
        psqlProcess.kill();
        throw new Error(`❌ Pipeline failed: ${err.message}`);
      }

      const exitCode = await new Promise<number>((resolve, reject) => {
        psqlProcess.on("close", (code) => resolve(code ?? 1));
        psqlProcess.on("error", (err: any) => {
          if (err.code === "ENOENT") {
            reject(new Error("❌ psql not found. Install PostgreSQL client tools."));
          } else {
            reject(new Error(`❌ psql error: ${err.message}`));
          }
        });
      });

      if (exitCode !== 0) {
        console.error(`❌ Restore failed: psql exited with code ${exitCode}`);
        return false;
      }
    } else {
      // Direct psql restore with file argument
      const pgEnv = getPgEnvVars(databaseUrl);
      const psqlArgs = ["-v", "ON_ERROR_STOP=1", "-1", "-f", backupPath];
      const psqlProcess = spawn("psql", psqlArgs, {
        env: { ...process.env, ...pgEnv },
        stdio: "inherit",
      });

      // Wait for process exit (error handling included in exitCode promise)
      const exitCode = await new Promise<number>((resolve, reject) => {
        psqlProcess.on("close", (code) => resolve(code ?? 1));
        psqlProcess.on("error", (err: any) => {
          if (err.code === "ENOENT") {
            reject(new Error("❌ psql not found. Install PostgreSQL client tools."));
          } else {
            reject(new Error(`❌ psql error: ${err.message}`));
          }
        });
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
  const { backupFilename } = options;
  const force = options.force ?? false;
  
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
    const postgresDir = getBackupDirForProvider("postgresql");
    const foundPath = join(postgresDir, backupFilename);
    if (!existsSync(foundPath)) {
      console.error(`❌ Backup not found: ${backupFilename}`);
      console.log("\n📋 Available backups:");
      const { listBackups } = await import("./backup.js");
      const backups = await listBackups();
      for (const b of backups) {
        console.log(`   - ${b.filename}`);
      }
      return false;
    }
    backupPath = foundPath;
  }

  return restorePostgreSQL(backupPath!, force);
}

/**
 * List available backups with restore options
 */
export async function listRestoreOptions(): Promise<void> {
  const { listBackups } = await import("./backup.js");
  const backups = await listBackups();
  
  console.log(`\n📦 Available Backups for Restore (postgresql):\n`);
  
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
