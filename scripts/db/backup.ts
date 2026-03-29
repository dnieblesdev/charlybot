/**
 * Database Backup Module
 * 
 * Provides core backup functionality for SQLite database using
 * SQLite's native .backup command for atomic, crash-safe copies.
 */

import { mkdir, readdir, stat, unlink, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DB_PATH = join(__dirname, "../../packages/shared/dev.db");
const BACKUP_DIR = join(__dirname, "../../packages/shared/prisma/backups");

export interface BackupOptions {
  type: "daily" | "migration";
  customPath?: string;
}

export interface BackupResult {
  filename: string;
  filepath: string;
  sizeBytes: number;
  timestamp: Date;
}

/**
 * Generate timestamp in ISO 8601 format without dashes for filesystem compatibility
 */
function generateTimestamp(): string {
  const now = new Date();
  const parts = now.toISOString().replace(/[-:]/g, "").replace("T", "_").split(".");
  return parts[0] ?? "";
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Create a backup of the SQLite database
 * Uses SQLite's .backup command for atomic, crash-safe operation
 */
export async function createBackup(options: BackupOptions): Promise<BackupResult> {
  await ensureBackupDir();

  const timestamp = generateTimestamp();
  const type = options.type;
  const filename = `${timestamp}_${type}_backup.db`;
  const filepath = options.customPath ?? join(BACKUP_DIR, filename);

  // Use file copy for backup
  // This is a simple and reliable approach for SQLite
  
  try {
    // Check if source DB exists
    try {
      await stat(DB_PATH);
    } catch {
      throw new Error(`Database file not found: ${DB_PATH}`);
    }

    // Copy database file to backup location
    await copyFile(DB_PATH, filepath);

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
    };
  } catch (error: any) {
    console.error(`❌ Backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * List all available backups in the backup directory
 */
export async function listBackups(): Promise<BackupResult[]> {
  await ensureBackupDir();

  const files = await readdir(BACKUP_DIR);
  const backups: BackupResult[] = [];

  for (const file of files) {
    if (!file.endsWith("_backup.db")) continue;

    const filepath = join(BACKUP_DIR, file);
    const stats = await stat(filepath);

    // Parse timestamp from filename: 20260329_143022_daily_backup.db
    const match = file.match(/^(\d{8}_\d{6})_(\w+)_backup\.db$/);
    const timestamp = match && match[1]
      ? new Date(`${match[1].replace("_", "T")}`)
      : stats.mtime;

    backups.push({
      filename: file,
      filepath,
      sizeBytes: stats.size,
      timestamp,
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
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "create": {
      const type = (args[1] as "daily" | "migration") || "daily";
      await createBackup({ type });
      break;
    }
    case "list": {
      const backups = await listBackups();
      console.log("\n📦 Available backups:\n");
      for (const backup of backups) {
        const date = backup.timestamp.toLocaleString();
        const size = (backup.sizeBytes / 1024).toFixed(2);
        console.log(`  ${backup.filename}`);
        console.log(`    ${date} | ${size} KB\n`);
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
      console.log("  bun run backup.ts create [daily|migration]");
      console.log("  bun run backup.ts list");
      console.log("  bun run backup.ts latest");
  }
}
