/**
 * Backup Rotation Module
 *
 * Manages backup retention by removing old backups beyond
 * the configured policy (7 daily, 3 migration).
 * Scans backups/postgres/ only.
 */

import { readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

import { isExecutedAsScript } from "./env.js";
import { getBackupDirForProvider } from "./provider.js";
import type { Provider } from "./provider.js";

const PROVIDER: Provider = "postgresql";

export interface RetentionPolicy {
  daily: number;      // default: 7
  migration: number;  // default: 3
}

const DEFAULT_POLICY: RetentionPolicy = {
  daily: 7,
  migration: 3,
};

/**
 * Get all backup files of a specific type from a directory
 */
async function getBackupsByType(
  backupDir: string,
  type: "daily" | "migration"
): Promise<string[]> {
  try {
    const files = await readdir(backupDir);

    const filtered = files.filter((f) => {
      const hasType = f.includes(`_${type}_`);
      return hasType && (f.endsWith("_backup.sql") || f.endsWith("_backup.sql.gz"));
    });

    return filtered.sort().reverse(); // Newest first
  } catch {
    // Directory doesn't exist yet
    return [];
  }
}

/**
 * Rotate backups for a single provider directory
 */
async function rotateProviderBackups(
  policy: RetentionPolicy
): Promise<number> {
  const backupDir = getBackupDirForProvider(PROVIDER);
  let deletedCount = 0;

  console.log(`\n📦 PostgreSQL backups:`);

  // Rotate daily backups
  const dailyBackups = await getBackupsByType(backupDir, "daily");
  if (dailyBackups.length > policy.daily) {
    const toDelete = dailyBackups.slice(policy.daily);
    console.log(`   🗑️  Removing ${toDelete.length} old daily backup(s):`);
    
    for (const file of toDelete) {
      const filepath = join(backupDir, file);
      await unlink(filepath);
      console.log(`      - ${file}`);
      deletedCount++;
    }
  } else {
    console.log(`   ✅ Daily: ${dailyBackups.length}/${policy.daily} (within limit)`);
  }

  // Rotate migration backups
  const migrationBackups = await getBackupsByType(backupDir, "migration");
  if (migrationBackups.length > policy.migration) {
    const toDelete = migrationBackups.slice(policy.migration);
    console.log(`   🗑️  Removing ${toDelete.length} old migration backup(s):`);
    
    for (const file of toDelete) {
      const filepath = join(backupDir, file);
      await unlink(filepath);
      console.log(`      - ${file}`);
      deletedCount++;
    }
  } else {
    console.log(`   ✅ Migration: ${migrationBackups.length}/${policy.migration} (within limit)`);
  }

  return deletedCount;
}

/**
 * Rotate backups based on retention policy (applies to ALL providers)
 */
export async function rotateBackups(policy: RetentionPolicy = DEFAULT_POLICY): Promise<number> {
  console.log("\n🔄 Running backup rotation...\n");

  let totalDeleted = 0;

  totalDeleted += await rotateProviderBackups(policy);

  console.log(`\n✨ Rotation complete. Deleted ${totalDeleted} backup(s).\n`);
  
  return totalDeleted;
}

/**
 * Show rotation status without deleting
 */
export async function showRotationStatus(policy: RetentionPolicy = DEFAULT_POLICY): Promise<void> {
  console.log("\n📊 Backup Rotation Status\n");
  console.log(`Policy: ${policy.daily} daily, ${policy.migration} migration\n`);

  await showProviderStatus(policy);

  console.log("🗑️ = will be removed on next rotation\n");
}

/**
 * Show status for a single provider
 */
async function showProviderStatus(
  policy: RetentionPolicy
): Promise<void> {
  const backupDir = getBackupDirForProvider(PROVIDER);

  console.log(`📦 PostgreSQL (current) [${backupDir.replace(/\\/g, "/")}]`);

  // Daily backups
  const dailyBackups = await getBackupsByType(backupDir, "daily");
  console.log(`   Daily: ${dailyBackups.length}/${policy.daily}`);
  
  for (const backup of dailyBackups) {
    try {
      const stats = await stat(join(backupDir, backup));
      const date = stats.mtime.toLocaleString();
      const size = (stats.size / 1024).toFixed(2);
      const mark = dailyBackups.indexOf(backup) >= policy.daily ? " 🗑️" : "";
      console.log(`     - ${backup} (${date}, ${size} KB)${mark}`);
    } catch {
      console.log(`     - ${backup} (file not accessible)`);
    }
  }

  // Migration backups
  const migrationBackups = await getBackupsByType(backupDir, "migration");
  console.log(`   Migration: ${migrationBackups.length}/${policy.migration}`);
  
  for (const backup of migrationBackups) {
    try {
      const stats = await stat(join(backupDir, backup));
      const date = stats.mtime.toLocaleString();
      const size = (stats.size / 1024).toFixed(2);
      const mark = migrationBackups.indexOf(backup) >= policy.migration ? " 🗑️" : "";
      console.log(`     - ${backup} (${date}, ${size} KB)${mark}`);
    } catch {
      console.log(`     - ${backup} (file not accessible)`);
    }
  }

  console.log("");
}

// CLI execution
if (isExecutedAsScript(import.meta.url)) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "run":
      case "rotate": {
        await rotateBackups();
        process.exit(0);
      }
      case "status": {
        await showRotationStatus();
        break;
      }
      default:
        console.log("Usage:");
        console.log("  pnpm db:rotate run");
        console.log("  pnpm db:rotate status");
    }
  })();
}
