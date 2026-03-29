/**
 * Database Restore Module
 * 
 * Provides restoration functionality from backup files.
 * Supports restoring to latest backup or a specific backup file.
 */

import { existsSync, copyFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DB_PATH = join(__dirname, "../../packages/shared/dev.db");
const BACKUP_DIR = join(__dirname, "../../packages/shared/prisma/backups");

export interface RestoreOptions {
  backupFilename: string | "latest";
  force?: boolean;  // Skip confirmation
}

/**
 * Find a backup file by name or get latest
 */
function resolveBackupFile(request: string | "latest"): string | null {
  if (request === "latest") {
    const { getLatestBackup } = require("./backup.js");
    // We need to import dynamically for ESM
    return null; // Will be resolved below
  }
  
  const filepath = join(BACKUP_DIR, request);
  if (existsSync(filepath)) {
    return filepath;
  }
  
  return null;
}

/**
 * Restore database from backup
 */
export async function restore(options: RestoreOptions): Promise<boolean> {
  const { backupFilename, force } = options;
  
  // Get latest backup if requested
  let backupPath: string | null;
  
  if (backupFilename === "latest") {
    const { getLatestBackup } = await import("./backup.ts");
    const latest = await getLatestBackup();
    
    if (!latest) {
      console.error("❌ No backups found");
      return false;
    }
    
    backupPath = latest.filepath;
    console.log(`📦 Using latest backup: ${latest.filename}`);
  } else {
    backupPath = join(BACKUP_DIR, backupFilename);
    
    if (!existsSync(backupPath)) {
      console.error(`❌ Backup not found: ${backupFilename}`);
      console.log("\n📋 Available backups:");
      const { listBackups } = await import("./backup.ts");
      const backups = await listBackups();
      for (const b of backups) {
        console.log(`   - ${b.filename}`);
      }
      return false;
    }
  }

  // Confirm restoration
  if (!force) {
    console.log("\n⚠️  WARNING: This will replace the current database!");
    console.log(`   Backup: ${backupPath}`);
    console.log(`   Target: ${DB_PATH}`);
    console.log("\n   To proceed, run with --force flag or delete the current database first.\n");
    
    // Check if current DB exists
    if (existsSync(DB_PATH)) {
      console.log("❌ Restore aborted. Delete the current database first or use --force.\n");
      return false;
    }
  }

  // Perform restoration
  console.log("🔄 Restoring database...\n");
  
  try {
    // If current DB exists and we have force, delete it first
    if (existsSync(DB_PATH)) {
      // Create a backup of the corrupted/current DB before replacing
      const corruptBackup = `${DB_PATH}.corrupt.${Date.now()}`;
      copyFileSync(DB_PATH, corruptBackup);
      console.log(`📦 Current DB backed up to: ${corruptBackup}`);
      unlinkSync(DB_PATH);
    }

    // Copy backup to main DB location
    copyFileSync(backupPath, DB_PATH);
    
    console.log("✅ Database restored successfully!");
    console.log(`   From: ${backupPath}`);
    console.log(`   To: ${DB_PATH}\n`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ Restore failed: ${error.message}`);
    return false;
  }
}

/**
 * List available backups with restore options
 */
export async function listRestoreOptions(): Promise<void> {
  const { listBackups } = await import("./backup.ts");
  const backups = await listBackups();
  
  console.log("\n📦 Available Backups for Restore:\n");
  
  if (backups.length === 0) {
    console.log("   No backups found.\n");
    return;
  }
  
  for (const backup of backups) {
    const date = backup.timestamp.toLocaleString();
    const size = (backup.sizeBytes / 1024).toFixed(2);
    console.log(`   ${backup.filename}`);
    console.log(`     ${date} | ${size} KB`);
    console.log(`     bun run scripts/db/restore.ts ${backup.filename}\n`);
  }
  
  console.log("   Quick restore latest:");
  console.log("   bun run scripts/db/restore.ts latest\n");
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
