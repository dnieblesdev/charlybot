import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.resolve(
  __dirname,
  "../../prisma/migrations/20260606044500_database_normalization_hardening_money_int/migration.sql",
);

describe("money integer migration", () => {
  it("documents round-and-rename backfill steps for every in-scope money table", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("ROUND(\"pocket\")::INTEGER");
    expect(sql).toContain("ROUND(\"totalEarned\")::INTEGER");
    expect(sql).toContain("ROUND(\"totalLost\")::INTEGER");
    expect(sql).toContain("ROUND(\"bank\")::INTEGER");
    expect(sql).toContain("ROUND(\"amount\")::INTEGER");
    expect(sql).toContain("ROUND(\"winAmount\")::INTEGER");
    expect(sql).toContain("ROUND(\"totalMoney\")::INTEGER");
    expect(sql).toContain('RENAME COLUMN "pocket_next" TO "pocket"');
    expect(sql).toContain('RENAME COLUMN "bank_next" TO "bank"');
    expect(sql).toContain('RENAME COLUMN "amount_next" TO "amount"');
    expect(sql).toContain('RENAME COLUMN "totalMoney_next" TO "totalMoney"');
    expect(sql).toContain('CREATE INDEX "Leaderboard_guildId_totalMoney_joinedServerAt_idx"');
    expect(sql).toContain('ON "Leaderboard"("guildId", "totalMoney", "joinedServerAt")');
  });
});
