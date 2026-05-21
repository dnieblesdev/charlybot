/**
 * Backup Rotation Module
 * 
 * Manages backup retention by removing old backups beyond
 * the configured policy (7 daily, 3 migration per provider).
 * Scans both backups/postgres/ and backups/sqlite/ directories.
 */

import { readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { detectProvider, getBackupDir, getBackupDirForProvider } from "./provider.js";
import type { Provider } from "./provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(import.meta.url).replace(/[/\\][^/\\]*$/, "");

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
  type: "daily" | "migration",
  provider: Provider
): Promise<string[]> {
  try {
    const files = await readdir(backupDir);
    
    // Filter by provider-specific extensions
    const filtered = files.filter(f => {
      const hasType = f.includes(`_${type}_`);
      
      if (provider === "postgresql") {
        return hasType && (f.endsWith("_backup.sql") || f.endsWith("_backup.sql.gz"));
      } else {
        return hasType && f.endsWith("_backup.db");
      }
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
  provider: Provider,
  policy: RetentionPolicy
): Promise<number> {
  const backupDir = getBackupDirForProvider(provider);
  let deletedCount = 0;

  console.log(`\n${provider === "postgresql" ? "📦 PostgreSQL" : "💾 SQLite"} backups:`);

  // Rotate daily backups
  const dailyBackups = await getBackupsByType(backupDir, "daily", provider);
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
  const migrationBackups = await getBackupsByType(backupDir, "migration", provider);
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

  // Rotate PostgreSQL backups
  totalDeleted += await rotateProviderBackups("postgresql", policy);

  // Rotate SQLite backups
  totalDeleted += await rotateProviderBackups("sqlite", policy);

  console.log(`\n✨ Rotation complete. Deleted ${totalDeleted} backup(s).\n`);
  
  return totalDeleted;
}

/**
 * Show rotation status without deleting
 */
export async function showRotationStatus(policy: RetentionPolicy = DEFAULT_POLICY): Promise<void> {
  console.log("\n📊 Backup Rotation Status\n");
  console.log(`Policy: ${policy.daily} daily, ${policy.migration} migration per provider\n`);

  const currentProvider = detectProvider();

  // Show PostgreSQL backups
  await showProviderStatus("postgresql", policy, currentProvider);

  // Show SQLite backups
  await showProviderStatus("sqlite", policy, currentProvider);

  console.log("🗑️ = will be removed on next rotation\n");
}

/**
 * Show status for a single provider
 */
async function showProviderStatus(
  provider: Provider,
  policy: RetentionPolicy,
  currentProvider: Provider
): Promise<void> {
  const backupDir = getBackupDirForProvider(provider);
  const label = provider === "postgresql" ? "📦 PostgreSQL" : "💾 SQLite";
  const marker = provider === currentProvider ? " (current)" : "";

  console.log(`${label}${marker} [${backupDir.replace(/\\/g, "/")}]`);

  // Daily backups
  const dailyBackups = await getBackupsByType(backupDir, "daily", provider);
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
  const migrationBackups = await getBackupsByType(backupDir, "migration", provider);
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
if (import.meta.main) {
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