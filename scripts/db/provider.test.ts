/**
 * Tests for Database Provider Detection
 */

import { describe, it, expect } from "vitest";
import { detectProvider, getBackupDir, isPostgreSQL } from "./provider";

describe("detectProvider", () => {
  it("detects postgresql:// URLs as postgresql", () => {
    expect(detectProvider("postgresql://user:pass@localhost:5432/db")).toBe("postgresql");
  });

  it("detects postgres:// URLs as postgresql", () => {
    expect(detectProvider("postgres://user:pass@localhost:5432/db")).toBe("postgresql");
  });
});

describe("isPostgreSQL", () => {
  it("returns true for postgresql:// URLs", () => {
    expect(isPostgreSQL("postgresql://user:pass@localhost:5432/db")).toBe(true);
  });

  it("returns true for postgres:// URLs", () => {
    expect(isPostgreSQL("postgres://localhost/db")).toBe(true);
  });
});

describe("getBackupDir", () => {
  it("returns backups/postgres for postgresql URLs", () => {
    const result = getBackupDir("postgresql://localhost/db");
    expect(result.replace(/\\/g, "/")).toContain("backups/postgres");
  });

  it("returns backups/postgres for postgres:// URLs", () => {
    const result = getBackupDir("postgres://localhost/db");
    expect(result.replace(/\\/g, "/")).toContain("backups/postgres");
  });
});
