/**
 * Tests for Database Provider Detection
 */

import { describe, it, expect } from "vitest";
import { detectProvider, getBackupDir, isPostgreSQL, isSQLite } from "./provider";

describe("detectProvider", () => {
  it("detects postgresql:// URLs as postgresql", () => {
    expect(detectProvider("postgresql://user:pass@localhost:5432/db")).toBe("postgresql");
  });

  it("detects postgres:// URLs as postgresql", () => {
    expect(detectProvider("postgres://user:pass@localhost:5432/db")).toBe("postgresql");
  });

  it("detects file: URLs as sqlite", () => {
    expect(detectProvider("file:./dev.db")).toBe("sqlite");
  });

  it("detects relative file paths as sqlite", () => {
    expect(detectProvider("file:../../dev.db")).toBe("sqlite");
  });

  it("detects libsql:// URLs as sqlite", () => {
    expect(detectProvider("libsql://localhost:8080")).toBe("sqlite");
  });
});

describe("isPostgreSQL", () => {
  it("returns true for postgresql:// URLs", () => {
    expect(isPostgreSQL("postgresql://user:pass@localhost:5432/db")).toBe(true);
  });

  it("returns true for postgres:// URLs", () => {
    expect(isPostgreSQL("postgres://localhost/db")).toBe(true);
  });

  it("returns false for file:// URLs", () => {
    expect(isPostgreSQL("file:./dev.db")).toBe(false);
  });
});

describe("isSQLite", () => {
  it("returns true for file:// URLs", () => {
    expect(isSQLite("file:./dev.db")).toBe(true);
  });

  it("returns true for relative paths", () => {
    expect(isSQLite("file:../../dev.db")).toBe(true);
  });

  it("returns false for postgresql:// URLs", () => {
    expect(isSQLite("postgresql://user:pass@localhost:5432/db")).toBe(false);
  });
});

describe("getBackupDir", () => {
  it("returns backups/postgres for postgresql URLs", () => {
    const result = getBackupDir("postgresql://localhost/db");
    expect(result.replace(/\\/g, "/")).toContain("backups/postgres");
  });

  it("returns backups/sqlite for file URLs", () => {
    const result = getBackupDir("file:./dev.db");
    expect(result.replace(/\\/g, "/")).toContain("backups/sqlite");
  });

  it("returns backups/postgres for postgres:// URLs", () => {
    const result = getBackupDir("postgres://localhost/db");
    expect(result.replace(/\\/g, "/")).toContain("backups/postgres");
  });
});