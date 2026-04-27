import { beforeAll, afterAll, afterEach, vi } from "vitest";

/**
 * Global test setup for Vitest.
 * This file runs once before all tests.
 */

// Increase timeout for database operations
const TEST_TIMEOUT = 15000;
const SETUP_TIMEOUT = 20000;

// Required by authMiddleware during module import in API tests.
process.env.API_KEY ??= "charly_secret_key";

// Required by jwt.ts getSecret() — avoids 500 when JWT_SECRET is missing
process.env.JWT_SECRET ??= "test-secret";

// Normalize relative Request URLs for app.fetch() in the Node test runtime.
const OriginalRequest = globalThis.Request;
globalThis.Request = class extends OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === "string" && input.startsWith("/")) {
      super(`http://localhost${input}`, init);
      return;
    }

    super(input, init);
  }
};

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
