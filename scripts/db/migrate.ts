/**
 * Database Migration Wrapper
 * 
 * Automatically creates a backup before running Prisma migrations.
 * If migration fails, provides easy rollback to the pre-migration backup.
 */

import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DB_PATH = join(__dirname, "../../packages/shared/dev.db");
const BACKUP_SCRIPT = join(__dirname, "./backup.ts");

interface MigrationResult {
  success: boolean;
  backupFilepath?: string;
  error?: string;
}

/**
 * Run pre-migration backup
 */
async function preMigrationBackup(): Promise<string | null> {
  const { createBackup, getLatestBackup } = await import("./backup.ts");
  
  console.log("\n📦 Creating pre-migration backup...");
  
  try {
    const result = await createBackup({ type: "migration" });
    console.log(`✅ Pre-migration backup ready: ${result.filepath}\n`);
    return result.filepath;
  } catch (error: any) {
    console.error(`❌ Pre-migration backup failed: ${error.message}`);
    console.error("⚠️  WARNING: Proceeding with migration WITHOUT backup!");
    return null;
  }
}

/**
 * Run Prisma migration command
 */
async function runPrismaMigrate(args: string[]): Promise<number> {
  const { execSync } = await import("node:child_process");
  
  const prismaCmd = `bunx prisma migrate deploy --schema=./prisma/schema.prisma ${args.join(" ")}`;
  
  console.log(`Running: ${prismaCmd}\n`);
  
  try {
    execSync(prismaCmd, { 
      stdio: "inherit",
      cwd: join(__dirname, "../../"),
    });
    return 0;
  } catch (error: any) {
    return error.status ?? 1;
  }
}

/**
 * Run Prisma db push command
 */
async function runPrismaPush(args: string[]): Promise<number> {
  const { execSync } = await import("node:child_process");
  
  const prismaCmd = `bunx prisma db push --schema=./prisma/schema.prisma ${args.join(" ")}`;
  
  console.log(`Running: ${prismaCmd}\n`);
  
  try {
    execSync(prismaCmd, { 
      stdio: "inherit",
      cwd: join(__dirname, "../../"),
    });
    return 0;
  } catch (error: any) {
    return error.status ?? 1;
  }
}

/**
 * Main migration flow
 */
export async function migrate(args: string[] = []): Promise<MigrationResult> {
  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.log("⚠️  Database doesn't exist. Running migration without backup.");
    
    const exitCode = await runPrismaMigrate(args);
    return {
      success: exitCode === 0,
      error: exitCode !== 0 ? "Migration failed" : undefined,
    };
  }

  // Create pre-migration backup
  const backupFilepath = await preMigrationBackup();
  
  if (!backupFilepath) {
    console.log("\n⚠️  Proceeding with migration despite backup failure!\n");
  }

  // Run migration
  console.log("🚀 Running migration...\n");
  const exitCode = await runPrismaMigrate(args);

  if (exitCode !== 0) {
    console.error(`\n❌ Migration failed with exit code ${exitCode}`);
    console.log("\n📌 To restore from backup, run:");
    console.log(`   bun run scripts/db/restore.ts ${backupFilepath}\n`);
    
    return {
      success: false,
      backupFilepath: backupFilepath ?? undefined,
      error: `Migration failed with exit code ${exitCode}`,
    };
  }

  console.log("\n✅ Migration completed successfully!");
  
  // Run rotation to clean old backups
  try {
    const { rotateBackups } = await import("./rotate.ts");
    await rotateBackups();
  } catch (error) {
    // Rotation failure is not critical
    console.log("ℹ️  Backup rotation skipped (can be run manually)");
  }

  return {
    success: true,
    backupFilepath: backupFilepath ?? undefined,
  };
}

/**
 * db push flow - same as migrate but using db push
 */
export async function dbPush(args: string[] = []): Promise<MigrationResult> {
  // Check if database exists
  if (!existsSync(DB_PATH)) {
    console.log("⚠️  Database doesn't exist. Running db push without backup.");
    
    const exitCode = await runPrismaPush(args);
    return {
      success: exitCode === 0,
      error: exitCode !== 0 ? "db push failed" : undefined,
    };
  }

  // Create pre-migration backup
  const backupFilepath = await preMigrationBackup();
  
  if (!backupFilepath) {
    console.log("\n⚠️  Proceeding with db push despite backup failure!\n");
  }

  // Run db push
  console.log("🚀 Running db push...\n");
  const exitCode = await runPrismaPush(args);

  if (exitCode !== 0) {
    console.error(`\n❌ db push failed with exit code ${exitCode}`);
    console.log("\n📌 To restore from backup, run:");
    console.log(`   bun run scripts/db/restore.ts ${backupFilepath}\n`);
    
    return {
      success: false,
      backupFilepath: backupFilepath ?? undefined,
      error: `db push failed with exit code ${exitCode}`,
    };
  }

  console.log("\n✅ db push completed successfully!");
  
  // Run rotation
  try {
    const { rotateBackups } = await import("./rotate.ts");
    await rotateBackups();
  } catch (error) {
    console.log("ℹ️  Backup rotation skipped");
  }

  return {
    success: true,
    backupFilepath: backupFilepath ?? undefined,
  };
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "migrate":
    case "deploy": {
      const result = await migrate(args.slice(1));
      process.exit(result.success ? 0 : 1);
      break;
    }
    case "push": {
      const result = await dbPush(args.slice(1));
      process.exit(result.success ? 0 : 1);
      break;
    }
    default:
      console.log("Usage:");
      console.log("  bun run scripts/db/migrate.ts migrate [args]");
      console.log("  bun run scripts/db/migrate.ts push [args]");
  }
}
