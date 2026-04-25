/**
 * Simple connectivity test for Valkey
 */

import { describe, it, expect } from "vitest";
import { createValkeyClient } from "@charlybot/shared";

// Try both localhost and host.docker.internal for Docker Desktop on Windows
const testHosts = ["localhost", "host.docker.internal"];

describe("Valkey Connectivity", () => {
  for (const host of testHosts) {
    it(`should connect to Valkey via ${host}`, async () => {
      const client = createValkeyClient({
        host,
        port: 6379,
        password: "",
        connectTimeoutMs: 5000,
        commandTimeoutMs: 5000,
        maxRetries: 3,
      });
      
      try {
        await client.connect();
        expect(client.isConnected()).toBe(true);
        
        // Simple ping via GET (which internally checks connection)
        const result = await client.get("test:ping");
        expect(result).toBeUndefined(); // Key doesn't exist, but connection works
      } finally {
        await client.disconnect();
      }
    });
  }
});
