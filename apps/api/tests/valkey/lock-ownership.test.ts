/**
 * Valkey distributed lock ownership tests.
 * Moved from race-conditions.test.ts (T6.5/T6.6) — these test Valkey directly,
 * not the HTTP API, so they belong in tests/valkey/.
 *
 * Requires a running Valkey instance on localhost:6379.
 * Tests are skipped if Valkey is not available.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createValkeyClient, type IValkeyClient } from "@charlybot/shared";

let valkey: IValkeyClient;
let valkeyAvailable = false;

beforeAll(async () => {
  try {
    valkey = createValkeyClient({
      host: process.env.VALKEY_HOST ?? "localhost",
      port: Number(process.env.VALKEY_PORT ?? "6379"),
    });
    await valkey.connect();
    valkeyAvailable = valkey.isConnected();
  } catch {
    valkeyAvailable = false;
  }
});

afterAll(async () => {
  if (valkeyAvailable) {
    await valkey.disconnect();
  }
});

describe("Valkey Lock Ownership", () => {
  it.skipIf(!valkeyAvailable)(
    "T6.5: lock should use UUID ownerId — wrong owner cannot release, correct owner can",
    async () => {
      const testLockKey = `test:uuid-owner:${Date.now()}`;
      const lockTtl = 10; // 10 seconds

      // Acquire a lock with ownerId1
      const ownerId1 = crypto.randomUUID();
      const acquired1 = await valkey.acquireLock(testLockKey, lockTtl, ownerId1);
      expect(acquired1).toBe(true);

      // Try to release with wrong ownerId — should fail (Lua script returns 0)
      await valkey.releaseLock(testLockKey, "wrong-owner-id");

      // Lock should still be held (not released by wrong owner)
      const ownerId2 = crypto.randomUUID();
      const acquired2 = await valkey.acquireLock(testLockKey, lockTtl, ownerId2);
      expect(acquired2).toBe(false); // Lock should still be held by ownerId1

      // Release with correct ownerId — should succeed
      await valkey.releaseLock(testLockKey, ownerId1);

      // Now lock should be available again
      const acquired3 = await valkey.acquireLock(testLockKey, lockTtl, ownerId2);
      expect(acquired3).toBe(true);

      // Cleanup
      await valkey.releaseLock(testLockKey, ownerId2);
    }
  );

  it.skipIf(!valkeyAvailable)(
    "T6.6: lock operations should fail-deny when unable to acquire (acquire returns false)",
    async () => {
      const testLockKey = `test:fail-deny:${Date.now()}`;
      const ownerId = crypto.randomUUID();

      // The lock should successfully acquire on first attempt
      const acquired = await valkey.acquireLock(testLockKey, 10, ownerId);
      expect(acquired).toBe(true);

      // A second acquire with different owner should fail
      const secondOwner = crypto.randomUUID();
      const acquired2 = await valkey.acquireLock(testLockKey, 10, secondOwner);
      expect(acquired2).toBe(false);

      // Cleanup
      await valkey.releaseLock(testLockKey, ownerId);
    }
  );
});
