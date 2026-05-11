import { describe, it, expect, vi, beforeEach } from "vitest";
import { AntiSpamService, SpamLevel } from "../../src/app/services/AntiSpamService";
import type { Message } from "discord.js";

// Mock ValkeyClient
function createMockValkeyClient(overrides?: {
  rateLimit?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
}) {
  return {
    rateLimit: overrides?.rateLimit ?? vi.fn(() => Promise.resolve(true)),
    get: overrides?.get ?? vi.fn(() => Promise.resolve(undefined)),
    set: overrides?.set ?? vi.fn(() => Promise.resolve()),
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(() => Promise.resolve()),
    isConnected: vi.fn(() => true),
  };
}

function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    guildId: "test-guild",
    author: { id: "test-user" },
    content: "Hello world",
    mentions: { users: { size: 0 } },
    id: "msg-123",
    member: {} as any,
    client: {} as any,
    delete: vi.fn(() => Promise.resolve()),
    ...overrides,
  } as unknown as Message;
}

describe("AntiSpamService", () => {
  let service: AntiSpamService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluate", () => {
    it("returns NONE when no spam detected", async () => {
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => Promise.resolve(true)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "Normal message" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
      expect(result.level).toBe(SpamLevel.NONE);
    });

    it("detects message rate limit spam", async () => {
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => Promise.resolve(false)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "Spam message" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.level).toBe(SpamLevel.WARNING);
      expect(result.reason).toContain("Rate limit");
    });

    it("detects mention spam", async () => {
      let callCount = 0;
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => {
          callCount++;
          // First call (message rate limit): allowed
          // Second call (mention rate limit): denied
          return callCount === 1 ? Promise.resolve(true) : Promise.resolve(false);
        }),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "Hey everyone!",
        mentions: { users: { size: 5 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.level).toBe(SpamLevel.MUTE_5MIN);
      expect(result.reason).toContain("Menciones masivas");
    });

    it("detects link spam", async () => {
      let callCount = 0;
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => {
          callCount++;
          // Message rate limit: allowed
          // Link rate limit: denied
          if (callCount === 1) return Promise.resolve(true);
          return Promise.resolve(false);
        }),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "Check this out https://spam.example.com",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.level).toBe(SpamLevel.MUTE_5MIN);
      expect(result.reason).toContain("Link spam");
    });

    it("detects duplicate content", async () => {
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => Promise.resolve(true)),
        get: vi.fn(() => Promise.resolve("1")), // Content already exists
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "BUY NOW BUY NOW BUY NOW",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.level).toBe(SpamLevel.MUTE_5MIN);
      expect(result.reason).toContain("duplicado");
    });

    it("detects caps spam", async () => {
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => Promise.resolve(true)),
        get: vi.fn(() => Promise.resolve(undefined)),
        set: vi.fn(() => Promise.resolve()),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "THIS IS ALL CAPS SPAM MESSAGE",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.level).toBe(SpamLevel.WARNING);
      expect(result.reason).toContain("Caps spam");
    });

    it("fails open when Valkey throws", async () => {
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => Promise.reject(new Error("Valkey down"))),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "Some message" });
      const result = await service.evaluate(message);

      // Should fail open — not crash
      expect(result.isSpam).toBe(false);
      expect(result.level).toBe(SpamLevel.NONE);
    });

    it("returns NONE for messages without guildId", async () => {
      const valkey = createMockValkeyClient();
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ guildId: undefined });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
      expect(result.level).toBe(SpamLevel.NONE);
    });

    it("returns highest level when multiple checks trigger", async () => {
      let callCount = 0;
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => {
          callCount++;
          // Message rate limit: denied (WARNING)
          if (callCount === 1) return Promise.resolve(false);
          // Mention rate limit: denied (MUTE_5MIN)
          return Promise.resolve(false);
        }),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "SPAM MESSAGE IN ALL CAPS!!",
        mentions: { users: { size: 5 } },
      });
      const result = await service.evaluate(message);

      // Should return the highest level (MUTE_5MIN > WARNING)
      expect(result.isSpam).toBe(true);
      expect(result.level).toBe(SpamLevel.MUTE_5MIN);
    });
  });

  describe("checkCapsSpam", () => {
    it("ignores short messages", async () => {
      const valkey = createMockValkeyClient();
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "HI" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
    });

    it("ignores messages with no alphabetic chars", async () => {
      const valkey = createMockValkeyClient({
        rateLimit: vi.fn(() => Promise.resolve(true)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "1234567890!@#$%" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
    });
  });
});
