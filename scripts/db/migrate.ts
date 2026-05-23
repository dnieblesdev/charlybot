/**
 * Database Migration Wrapper
 * 
 * Automatically creates a backup before running Prisma migrations.
 * If migration fails, provides easy rollback to the pre-migration backup.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationResult {
  success: boolean;
  backupFilepath?: string;
  error?: string;
}

/**
 * Run pre-migration backup
 */
async function preMigrationBackup(): Promise<string | null> {
  const { createBackup } = await import("./backup.js");
  
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
 * Check if database exists.
 * For PostgreSQL in this repo, we consider the DB configured if DATABASE_URL is set.
 */
async function dbExists(): Promise<boolean> {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Spawn a command and wait for it to complete (async, non-blocking)
 */
function spawnAsync(
  command: string,
  args: string[],
  cwd: string
): Promise<number> {
  // Windows: pnpm is typically a .cmd shim, so spawn needs the .cmd suffix
  const cmd = process.platform === "win32" && command === "pnpm"
    ? "pnpm.cmd"
    : command;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
    });
    
    child.on("error", (error: any) => {
      reject(new Error(`${command} failed: ${error.message}`));
    });
    
    child.on("close", (code: number | null) => {
      resolve(code ?? 1);
    });
  });
}

/**
 * Run Prisma migration dev command (creates new migration from schema diff)
 */
async function runPrismaMigrateDev(args: string[]): Promise<number> {
  const prismaArgs = [
    "exec",
    "prisma",
    "migrate",
    "dev",
    `--schema=./prisma/schema.prisma`,
    ...args,
  ];
  
  console.log(`Running: pnpm ${prismaArgs.join(" ")}\n`);
  
  const exitCode = await spawnAsync("pnpm", prismaArgs, join(__dirname, "../../packages/shared"));
  return exitCode;
}

/**
 * Run Prisma migration command (production deploy)
 */
async function runPrismaMigrate(args: string[]): Promise<number> {
  const prismaArgs = [
    "exec",
    "prisma",
    "migrate",
    "deploy",
    `--schema=./prisma/schema.prisma`,
    ...args,
  ];
  
  console.log(`Running: pnpm ${prismaArgs.join(" ")}\n`);
  
  const exitCode = await spawnAsync("pnpm", prismaArgs, join(__dirname, "../../packages/shared"));
  return exitCode;
}

/**
 * Run Prisma db push command
 */
async function runPrismaPush(args: string[]): Promise<number> {
  const prismaArgs = [
    "exec",
    "prisma",
    "db",
    "push",
    `--schema=./prisma/schema.prisma`,
    ...args,
  ];
  
  console.log(`Running: pnpm ${prismaArgs.join(" ")}\n`);
  
  const exitCode = await spawnAsync("pnpm", prismaArgs, join(__dirname, "../../packages/shared"));
  return exitCode;
}

/**
 * Run backup rotation after successful migration
 */
async function runRotation(): Promise<void> {
  try {
    const { rotateBackups } = await import("./rotate.js");
    await rotateBackups();
  } catch {
    console.log("ℹ️  Backup rotation skipped");
  }
}

/**
 * Dev migration flow — creates a new migration from schema changes
 */
export async function migrateDev(args: string[] = []): Promise<MigrationResult> {
  // Check if database exists FIRST (handles empty DATABASE_URL gracefully)
  const exists = await dbExists();
  
  if (!exists) {
    console.log(`⚠️  Database doesn't exist. Running migration without backup.`);
    console.log(`   First time setup — ensure DATABASE_URL is set correctly.\n`);
    
    const exitCode = await runPrismaMigrateDev(args);
    return {
      success: exitCode === 0,
      error: exitCode !== 0 ? "Migration dev failed" : undefined,
    };
  }

  // Create pre-migration backup
  const backupFilepath = await preMigrationBackup();
  
  if (!backupFilepath) {
    console.log("\n⚠️  Proceeding with migration despite backup failure!\n");
  }

  // Run migration dev
  console.log("🚀 Creating migration...\n");
  const exitCode = await runPrismaMigrateDev(args);

  if (exitCode !== 0) {
    console.error(`\n❌ Migration dev failed with exit code ${exitCode}`);
    
    if (backupFilepath) {
      console.log("\n📌 To restore from backup, run:");
      console.log(`   pnpm db:restore latest --force\n`);
    }
    
    return {
      success: false,
      backupFilepath: backupFilepath ?? undefined,
      error: `Migration dev failed with exit code ${exitCode}`,
    };
  }

  console.log("\n✅ Migration created successfully!");
  
  // Run rotation
  await runRotation();

  return {
    success: true,
    backupFilepath: backupFilepath ?? undefined,
  };
}

/**
 * Main migration flow (production deploy)
 */
export async function migrate(args: string[] = []): Promise<MigrationResult> {
  // Check if database exists FIRST
  const exists = await dbExists();
  
  if (!exists) {
    console.log(`⚠️  Database doesn't exist. Running migration without backup.`);
    console.log(`   First time setup — ensure DATABASE_URL is set correctly.\n`);
    
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
    
    if (backupFilepath) {
      console.log("\n📌 To restore from backup, run:");
      console.log(`   pnpm db:restore latest --force\n`);
    }
    
    return {
      success: false,
      backupFilepath: backupFilepath ?? undefined,
      error: `Migration failed with exit code ${exitCode}`,
    };
  }

  console.log("\n✅ Migration completed successfully!");
  
  // Run rotation to clean old backups
  await runRotation();

  return {
    success: true,
    backupFilepath: backupFilepath ?? undefined,
  };
}

/**
 * db push flow — syncs schema without migration file
 */
export async function dbPush(args: string[] = []): Promise<MigrationResult> {
  // Check if database exists FIRST
  const exists = await dbExists();
  
  if (!exists) {
    console.log(`⚠️  Database doesn't exist. Running db push without backup.`);
    console.log(`   First time setup — ensure DATABASE_URL is set correctly.\n`);
    
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
    
    if (backupFilepath) {
      console.log("\n📌 To restore from backup, run:");
      console.log(`   pnpm db:restore latest --force\n`);
    }
    
    return {
      success: false,
      backupFilepath: backupFilepath ?? undefined,
      error: `db push failed with exit code ${exitCode}`,
    };
  }

  console.log("\n✅ db push completed successfully!");
  
  // Run rotation
  await runRotation();

  return {
    success: true,
    backupFilepath: backupFilepath ?? undefined,
  };
}

// CLI execution
if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "migrate":
      case "deploy": {
        const result = await migrate(args.slice(1));
        process.exit(result.success ? 0 : 1);
      }
      case "dev": {
        const result = await migrateDev(args.slice(1));
        process.exit(result.success ? 0 : 1);
      }
      case "push": {
        const result = await dbPush(args.slice(1));
        process.exit(result.success ? 0 : 1);
      }
      default:
        console.log("Usage:");
        console.log("  pnpm db:migrate dev [--name <name>]   → create new migration");
        console.log("  pnpm db:migrate deploy                → apply migrations (production)");
        console.log("  pnpm db:migrate push                  → sync schema without migration");
        console.log("\nNote: All commands create a backup before running.");
        process.exit(1);
    }
  })();
}
