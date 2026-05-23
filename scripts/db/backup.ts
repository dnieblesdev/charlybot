/**
 * Database Backup Module
 * 
 * Provides core backup functionality for PostgreSQL databases.
 * - PostgreSQL: uses pg_dump for SQL dumps (optionally compressed with gzip)
 */

import { mkdir, readdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

import { getBackupDirForProvider, getPgEnvVars } from "./provider.js";

export interface BackupOptions {
  type: "daily" | "migration";
  compress?: boolean;  // PostgreSQL only: gzip the output
  preserveAcl?: boolean; // PostgreSQL only: preserve ownership/ACLs (NOT recommended for dev)
}

export interface BackupResult {
  filename: string;
  filepath: string;
  sizeBytes: number;
  timestamp: Date;
  provider: "postgresql";
  format: "sql" | "sql.gz";
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
async function ensureBackupDir(provider: "postgresql"): Promise<string> {
  const backupDir = getBackupDirForProvider(provider);
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
 * Execute pg_dump and stream output to a file.
 * Uses spawn + Promise.all to wait for both process exit and pipeline completion,
 * avoiding race conditions between pgDump.on("close") and pipeline().
 */
async function runPgDump(
  databaseUrl: string,
  outputFile: string,
  compress: boolean,
  preserveAcl: boolean
): Promise<void> {
  // Extract credentials into env vars so pg_dump doesn't leak them in argv
  const pgEnv = getPgEnvVars(databaseUrl);
  const pgDumpArgs = [
    "--format=plain",
    // DEV-ONLY default: avoid restore permission errors across local users/roles.
    // WARNING: In prod, this DROPS all ownership + GRANT statements from the dump.
    ...(preserveAcl ? [] : ["--no-owner", "--no-acl"]),
    "--clean",
    "--if-exists",
  ];

  const fileHandle = createWriteStream(outputFile);

  return new Promise<void>((resolve, reject) => {
    const pgDump = spawn("pg_dump", pgDumpArgs, {
      env: { ...process.env, ...pgEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderrBuffer = "";

    pgDump.stderr.on("data", (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    // Guard: stdout may be null if spawn fails early
    if (!pgDump.stdout) {
      fileHandle.close();
      reject(new Error("❌ pg_dump stdout unavailable (spawn failed)"));
      return;
    }

    // Wait for process to exit (or error — reject immediately on spawn failure)
    const closePromise = new Promise<number | null>((res, rej) => {
      pgDump.on("close", (code) => res(code));
      pgDump.on("error", (err: any) => {
        if (err.code === "ENOENT") {
          rej(new Error(
            "❌ pg_dump not found. Install PostgreSQL client tools:\n" +
            "  macOS: brew install postgresql\n" +
            "  Ubuntu/Debian: apt-get install postgresql-client\n" +
            "  Windows: download from postgresql.org or use chocolatey: choco install postgresql"
          ));
        } else {
          rej(new Error(`❌ pg_dump failed: ${err.message}`));
        }
      });
    });

    // Wait for pipeline to finish (stdout → [gzip] → file)
    const pipePromise = compress
      ? pipeline(pgDump.stdout, createGzip(), fileHandle)
      : pipeline(pgDump.stdout, fileHandle);

    // Evaluate only after both settle — no race conditions
    Promise.all([closePromise, pipePromise])
      .then(([exitCode]) => {
        fileHandle.close();
        if (exitCode !== 0) {
          reject(new Error(
            `❌ pg_dump exited with code ${exitCode}. stderr: ${stderrBuffer.slice(0, 500)}`
          ));
        } else {
          resolve();
        }
      })
      .catch((err) => {
        fileHandle.close();
        pgDump.kill();
        reject(new Error(
          `❌ pg_dump pipeline failed: ${err.message}. stderr: ${stderrBuffer.slice(0, 500)}`
        ));
      });
  });
}

/**
 * Create a backup of the PostgreSQL database using pg_dump
 */
async function createPostgresBackup(
  databaseUrl: string,
  backupDir: string,
  type: "daily" | "migration",
  compress: boolean = false,
  preserveAcl: boolean = false
): Promise<BackupResult> {
  const timestamp = generateTimestamp();
  const ext = compress ? ".sql.gz" : ".sql";
  const filename = `${timestamp}_${type}_backup${ext}`;
  const filepath = join(backupDir, filename);

  console.log(`📦 Creating PostgreSQL backup...`);
  if (compress) {
    console.log(`   Compression: enabled (gzip)`);
  }

  await runPgDump(databaseUrl, filepath, compress, preserveAcl);

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
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      "DATABASE_URL is required for PostgreSQL backups.\n" +
      "  Set: postgresql://user:password@host:port/dbname"
    );
  }

  const backupDir = await ensureBackupDir("postgresql");
  const preserveAcl =
    options.preserveAcl ??
    String(process.env.PRESERVE_ACL ?? "").toLowerCase() === "true";
  return createPostgresBackup(dbUrl, backupDir, options.type, options.compress ?? false, preserveAcl);
}

/**
 * List all available backups in the backup directory for current provider
 */
export async function listBackups(): Promise<BackupResult[]> {
  const postgresDir = getBackupDirForProvider("postgresql");
  const backups: BackupResult[] = [];

  try {
    const files = await readdir(postgresDir);
    for (const file of files) {
      const matches = file.endsWith("_backup.sql") || file.endsWith("_backup.sql.gz");
      if (!matches) continue;

      const filepath = join(postgresDir, file);
      const stats = await stat(filepath);

      // Parse timestamp from filename: 20260329_143022_daily_backup.sql
      const match = file.match(/^(\d{8})_(\d{6})_(\w+)_backup/);
      const timestamp = match
        ? new Date(
            Date.UTC(
              parseInt(match[1].slice(0, 4)),
              parseInt(match[1].slice(4, 6)) - 1,
              parseInt(match[1].slice(6, 8)),
              parseInt(match[2].slice(0, 2)),
              parseInt(match[2].slice(2, 4)),
              parseInt(match[2].slice(4, 6))
            )
          )
        : stats.mtime;

      backups.push({
        filename: file,
        filepath,
        sizeBytes: stats.size,
        timestamp,
        provider: "postgresql",
        format: file.endsWith(".sql.gz") ? "sql.gz" : "sql",
      });
    }
  } catch {
    // Directory doesn't exist yet — skip silently
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
        const preserveAcl = args.includes("--preserve-acl");
        
        if (!compress) {
          console.log(`\n💡 Tip: Use --compress flag to gzip PostgreSQL backups:\n   pnpm db:backup create ${type} --compress\n`);
        }
        
        await createBackup({ type, compress, preserveAcl });
        break;
      }
      case "list": {
        const backups = await listBackups();
        
        console.log(`\n📦 Available backups (postgresql):\n`);
        
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
        console.log("  pnpm db:backup create [daily|migration] [--compress] [--preserve-acl]");
        console.log("  pnpm db:backup list");
        console.log("  pnpm db:backup latest");
    }
  })();
}
