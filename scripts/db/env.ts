import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const ENV_FILES = [
  resolve(REPO_ROOT, ".env"),
  resolve(REPO_ROOT, "packages/shared/.env"),
] as const;

let loaded = false;

export function loadPrismaEnvironment(): readonly string[] {
  if (loaded) {
    return ENV_FILES.filter((path) => existsSync(path));
  }

  loaded = true;

  for (const path of ENV_FILES) {
    if (!existsSync(path)) {
      continue;
    }

    loadDotenv({ path, override: false, quiet: true });
  }

  return ENV_FILES.filter((path) => existsSync(path));
}

export function isExecutedAsScript(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return resolve(entrypoint) === fileURLToPath(moduleUrl);
}

loadPrismaEnvironment();
