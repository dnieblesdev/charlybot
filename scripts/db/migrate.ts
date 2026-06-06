/**
 * Database Migration Wrapper
 * 
 * Automatically creates a backup before running Prisma migrations.
 * If migration fails, provides easy rollback to the pre-migration backup.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { isExecutedAsScript, loadPrismaEnvironment } from "./env.js";
import { requireDatabaseUrl } from "./provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadPrismaEnvironment();

interface MigrationResult {
  success: boolean;
  backupFilepath?: string;
  error?: string;
}

/**
 * Run pre-migration backup
 */
async function preMigrationBackup(): Promise<string> {
  const { createBackup } = await import("./backup.js");
  
  console.log("\n📦 Creating pre-migration backup...");

  const result = await createBackup({ type: "migration" });
  console.log(`✅ Pre-migration backup ready: ${result.filepath}\n`);
  return result.filepath;
}

/**
 * Spawn a command and wait for it to complete (async, non-blocking)
 */
function spawnAsync(
  command: string,
  args: string[],
  cwd: string
): Promise<number> {
  const useWindowsCommandShim = process.platform === "win32" && command === "pnpm";
  const cmd = useWindowsCommandShim ? "cmd.exe" : command;
  const cmdArgs = useWindowsCommandShim
    ? ["/d", "/s", "/c", ["pnpm", ...args].map(quoteWindowsCmdArg).join(" ")]
    : args;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
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

function quoteWindowsCmdArg(value: string): string {
  if (!/[\s"&()<>^|]/.test(value)) {
    return value;
  }

  return `"${value.replace(/(\\*)"/g, '$1$1\\"')}"`;
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

function normalizeForwardedArgs(args: string[]): string[] {
  return args[0] === "--" ? args.slice(1) : args;
}

function ensureMutationPrerequisites(): void {
  requireDatabaseUrl();
}

/**
 * Dev migration flow — creates a new migration from schema changes
 */
export async function migrateDev(args: string[] = []): Promise<MigrationResult> {
  try {
    ensureMutationPrerequisites();
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Create pre-migration backup
  let backupFilepath: string;
  try {
    backupFilepath = await preMigrationBackup();
  } catch (error: any) {
    console.error(`\n❌ Pre-migration backup failed: ${error.message}`);
    console.error("🛑 Migration dev aborted before Prisma mutate step.\n");
    return {
      success: false,
      error: `Pre-migration backup failed: ${error.message}`,
    };
  }

  // Run migration dev
  console.log("🚀 Creating migration...\n");
  const exitCode = await runPrismaMigrateDev(normalizeForwardedArgs(args));

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
  try {
    ensureMutationPrerequisites();
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Create pre-migration backup
  let backupFilepath: string;
  try {
    backupFilepath = await preMigrationBackup();
  } catch (error: any) {
    console.error(`\n❌ Pre-migration backup failed: ${error.message}`);
    console.error("🛑 Migration aborted before Prisma mutate step.\n");
    return {
      success: false,
      error: `Pre-migration backup failed: ${error.message}`,
    };
  }

  // Run migration
  console.log("🚀 Running migration...\n");
  const exitCode = await runPrismaMigrate(normalizeForwardedArgs(args));

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
  try {
    ensureMutationPrerequisites();
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Create pre-migration backup
  let backupFilepath: string;
  try {
    backupFilepath = await preMigrationBackup();
  } catch (error: any) {
    console.error(`\n❌ Pre-migration backup failed: ${error.message}`);
    console.error("🛑 db push aborted before Prisma mutate step.\n");
    return {
      success: false,
      error: `Pre-migration backup failed: ${error.message}`,
    };
  }

  // Run db push
  console.log("🚀 Running db push...\n");
  const exitCode = await runPrismaPush(normalizeForwardedArgs(args));

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
if (isExecutedAsScript(import.meta.url)) {
  (async () => {
    const args = process.argv.slice(2);
    const command = args[0] ?? "migrate";

    switch (command) {
      case "help":
      case "--help":
      case "-h": {
        console.log("Usage:");
        console.log("  pnpm db:migrate dev [--name <name>]   → create new migration");
        console.log("  pnpm db:migrate                       → apply pending migrations");
        console.log("  pnpm db:migrate deploy                → apply pending migrations");
        console.log("  pnpm db:migrate:dev -- --name <name>  → create new migration");
        console.log("  pnpm db:migrate:deploy                → apply pending migrations");
        console.log("  pnpm db:migrate push                  → sync schema without migration");
        console.log("\nNote: All mutating commands require DATABASE_URL and a successful pre-migration backup.");
        process.exit(0);
      }
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
        console.log("  pnpm db:migrate                       → apply pending migrations");
        console.log("  pnpm db:migrate deploy                → apply pending migrations");
        console.log("  pnpm db:migrate:dev -- --name <name>  → create new migration");
        console.log("  pnpm db:migrate:deploy                → apply pending migrations");
        console.log("  pnpm db:migrate push                  → sync schema without migration");
        console.log("\nNote: All mutating commands require DATABASE_URL and create a backup before running.");
        process.exit(1);
    }
  })();
}
