import { beforeAll, afterAll, afterEach, vi } from "vitest";

/**
 * Global test setup for Vitest.
 * This file runs once before all tests.
 */

// Increase timeout for database operations
const TEST_TIMEOUT = 15000;
const SETUP_TIMEOUT = 20000;

beforeAll(async () => {
  // Set longer timeouts for integration tests
  vi.setConfig({
    testTimeout: TEST_TIMEOUT,
    hookTimeout: SETUP_TIMEOUT,
  });
});

afterAll(async () => {
  // Cleanup if needed
});

afterEach(async () => {
  // Any per-test cleanup can go here
  // Note: We rely on Prisma transactions for isolation, so no manual cleanup needed
});
