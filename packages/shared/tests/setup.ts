import { beforeAll, afterAll, afterEach, vi } from "vitest";

/**
 * Global test setup for Vitest in @charlybot/shared.
 * Runs once before all tests in packages/shared/.
 */

beforeAll(() => {
  vi.setConfig({
    testTimeout: 5000,
    hookTimeout: 5000,
  });
});

afterAll(() => {
  // Cleanup if needed
});

afterEach(() => {
  vi.clearAllMocks();
});