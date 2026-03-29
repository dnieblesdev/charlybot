/**
 * Backup Rotation Module
 * 
 * Manages backup retention by removing old backups beyond
 * the configured policy (7 daily, 3 migration).
 */

import { readdir, unlink, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BACKUP_DIR = join(__dirname, "../../packages/shared/prisma/backups");

export interface RetentionPolicy {
  daily: number;      // default: 7
  migration: number;  // default: 3
}

const DEFAULT_POLICY: RetentionPolicy = {
  daily: 7,
  migration: 3,
};

/**
 * Get all backup files of a specific type
 */
async function getBackupsByType(type: "daily" | "migration"): Promise<string[]> {
  const files = await readdir(BACKUP_DIR);
  return files
    .filter(f => f.includes(`_${type}_`))
    .filter(f => f.endsWith("_backup.db"))
    .sort()
    .reverse(); // Newest first
}

/**
 * Rotate backups based on retention policy
 */
export async function rotateBackups(policy: RetentionPolicy = DEFAULT_POLICY): Promise<number> {
  console.log("\n🔄 Running backup rotation...\n");

  let deletedCount = 0;

  // Rotate daily backups
  const dailyBackups = await getBackupsByType("daily");
  if (dailyBackups.length > policy.daily) {
    const toDelete = dailyBackups.slice(policy.daily);
    console.log(`🗑️  Removing ${toDelete.length} old daily backup(s):`);
    
    for (const file of toDelete) {
      const filepath = join(BACKUP_DIR, file);
      await unlink(filepath);
      console.log(`   - ${file}`);
      deletedCount++;
    }
  } else {
    console.log(`✅ Daily backups: ${dailyBackups.length}/${policy.daily} (within limit)`);
  }

  // Rotate migration backups
  const migrationBackups = await getBackupsByType("migration");
  if (migrationBackups.length > policy.migration) {
    const toDelete = migrationBackups.slice(policy.migration);
    console.log(`\n🗑️  Removing ${toDelete.length} old migration backup(s):`);
    
    for (const file of toDelete) {
      const filepath = join(BACKUP_DIR, file);
      await unlink(filepath);
      console.log(`   - ${file}`);
      deletedCount++;
    }
  } else {
    console.log(`✅ Migration backups: ${migrationBackups.length}/${policy.migration} (within limit)`);
  }

  console.log(`\n✨ Rotation complete. Deleted ${deletedCount} backup(s).\n`);
  
  return deletedCount;
}

/**
 * Show rotation status without deleting
 */
export async function showRotationStatus(policy: RetentionPolicy = DEFAULT_POLICY): Promise<void> {
  console.log("\n📊 Backup Rotation Status\n");
  console.log(`Policy: ${policy.daily} daily, ${policy.migration} migration\n`);

  const dailyBackups = await getBackupsByType("daily");
  const migrationBackups = await getBackupsByType("migration");

  console.log(`Daily backups: ${dailyBackups.length}/${policy.daily}`);
  for (const backup of dailyBackups) {
    const stats = await stat(join(BACKUP_DIR, backup));
    const date = stats.mtime.toLocaleString();
    const size = (stats.size / 1024).toFixed(2);
    const mark = dailyBackups.indexOf(backup) >= policy.daily ? " 🗑️" : "";
    console.log(`  - ${backup} (${date}, ${size} KB)${mark}`);
  }

  console.log(`\nMigration backups: ${migrationBackups.length}/${policy.migration}`);
  for (const backup of migrationBackups) {
    const stats = await stat(join(BACKUP_DIR, backup));
    const date = stats.mtime.toLocaleString();
    const size = (stats.size / 1024).toFixed(2);
    const mark = migrationBackups.indexOf(backup) >= policy.migration ? " 🗑️" : "";
    console.log(`  - ${backup} (${date}, ${size} KB)${mark}`);
  }

  console.log("\n🗑️ = will be removed on next rotation\n");
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "run":
    case "rotate": {
      const count = await rotateBackups();
      process.exit(0);
      break;
    }
    case "status": {
      await showRotationStatus();
      break;
    }
    default:
      console.log("Usage:");
      console.log("  bun run scripts/db/rotate.ts run");
      console.log("  bun run scripts/db/rotate.ts status");
  }
}
