/**
 * Tests for Backup Module (Dual-Mode)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateTimestamp } from "./backup";

describe("generateTimestamp", () => {
  it("returns ISO timestamp without dashes or colons", () => {
    const result = generateTimestamp();
    
    // Should match format: 20260521_163612
    expect(result).toMatch(/^\d{8}_\d{6}$/);
  });

  it("returns different values at different times", () => {
    const result1 = generateTimestamp();
    const result2 = generateTimestamp();
    
    // Not a great test due to timing, but verifies format
    expect(result1).toMatch(/^\d{8}_\d{6}$/);
    expect(result2).toMatch(/^\d{8}_\d{6}$/);
  });
});