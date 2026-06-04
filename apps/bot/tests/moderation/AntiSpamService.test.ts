import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IAntiSpamConfig } from "@charlybot/shared/schemas/antispam";
import {
  AntiSpamService,
  getCapsRatio,
  isCapsSpamContent,
  isUppercaseLaughterOnly,
} from "../../src/app/services/AntiSpamService";
import { AntiSpamAction } from "../../src/app/services/SpamCheckResult";
import type { Message } from "discord.js";

// Mock ValkeyClient
function createMockValkeyClient(overrides?: {
  rateLimit?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
  sortedSetAdd?: ReturnType<typeof vi.fn>;
  sortedSetRemoveByScore?: ReturnType<typeof vi.fn>;
  sortedSetRangeByScore?: ReturnType<typeof vi.fn>;
  expire?: ReturnType<typeof vi.fn>;
  acquireLock?: ReturnType<typeof vi.fn>;
  releaseLock?: ReturnType<typeof vi.fn>;
}) {
  return {
    rateLimit: overrides?.rateLimit ?? vi.fn(() => Promise.resolve(true)),
    get: overrides?.get ?? vi.fn(() => Promise.resolve(undefined)),
    set: overrides?.set ?? vi.fn(() => Promise.resolve()),
    sortedSetAdd: overrides?.sortedSetAdd ?? vi.fn(() => Promise.resolve(1)),
    sortedSetRemoveByScore: overrides?.sortedSetRemoveByScore ?? vi.fn(() => Promise.resolve(0)),
    sortedSetRangeByScore: overrides?.sortedSetRangeByScore ?? vi.fn(() => Promise.resolve([])),
    expire: overrides?.expire ?? vi.fn(() => Promise.resolve()),
    acquireLock: overrides?.acquireLock ?? vi.fn(() => Promise.resolve(true)),
    releaseLock: overrides?.releaseLock ?? vi.fn(() => Promise.resolve()),
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
    channel: { id: "ch-1" },
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
    it("returns not spam when no spam detected", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "Normal message" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
      expect(result.pattern).toBe("");
      expect(result.action).toBe(AntiSpamAction.WARN);
    });

    it("detects message rate limit spam (rateLimit pattern)", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() =>
          Promise.resolve([
            "msg-1:ch-1",
            "msg-2:ch-1",
            "msg-3:ch-1",
            "msg-4:ch-1",
            "msg-5:ch-1",
            "msg-6:ch-1",
          ]),
        ),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "Spam message" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.pattern).toBe("rateLimit");
      expect(result.action).toBe("warn");
      expect(result.reason).toContain("Rate limit");
      expect(result.messageIds).toHaveLength(6);
    });

    it("detects mention spam", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
        rateLimit: vi.fn(() => Promise.resolve(false)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "Hey everyone!",
        mentions: { users: { size: 5 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.pattern).toBe("mention");
      expect(result.action).toBe("timeout_5min");
      expect(result.reason).toContain("Mention spam");
    });

    it("detects link spam", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
        rateLimit: vi.fn(() => Promise.resolve(false)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "Check this out https://spam.example.com",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.pattern).toBe("link");
      expect(result.action).toBe("timeout_5min");
      expect(result.reason).toContain("Link spam");
    });

    it("detects duplicate content", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
        get: vi.fn((key: string) => {
          // actionTaken guard should NOT be set for this test
          if (key.includes("actionTaken")) return Promise.resolve(undefined);
          // simulate duplicate content already exists
          return Promise.resolve("1");
        }),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "BUY NOW BUY NOW BUY NOW",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.pattern).toBe("duplicate");
      expect(result.action).toBe("warn");
      expect(result.reason).toContain("Duplicate");
    });

    it("detects caps spam", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
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
      expect(result.pattern).toBe("caps");
      expect(result.action).toBe("warn");
      expect(result.reason).toContain("Caps spam");
    });

    it("does not flag uppercase laughter by caps alone", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
        get: vi.fn(() => Promise.resolve(undefined)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "AJAJJAJJJJAJAA",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
      expect(result.pattern).toBe("");
    });

    it("still flags shouting mixed with uppercase laughter", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
        get: vi.fn(() => Promise.resolve(undefined)),
        set: vi.fn(() => Promise.resolve()),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "JAJAJA CALLATE AHORA",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(true);
      expect(result.pattern).toBe("caps");
    });

    it("does not run caps detection when caps are disabled", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
      });
      service = new AntiSpamService(valkey, {
        enabled: true,
        burstEnabled: false,
        duplicateEnabled: false,
        mentionEnabled: false,
        linkEnabled: false,
        capsEnabled: false,
        emojiEnabled: false,
        comboEnabled: false,
      } as IAntiSpamConfig);

      const message = createMockMessage({
        content: "CALLATE AHORA MISMO",
        mentions: { users: { size: 0 } },
      });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
      expect(result.pattern).toBe("");
    });

    it("fails open when Valkey throws", async () => {
      const valkey = createMockValkeyClient({
        sortedSetAdd: vi.fn(() => Promise.reject(new Error("Valkey down"))),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "Some message" });
      const result = await service.evaluate(message);

      // Should fail open — not crash
      expect(result.isSpam).toBe(false);
      expect(result.pattern).toBe("");
    });

    it("returns not spam for messages without guildId", async () => {
      const valkey = createMockValkeyClient();
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ guildId: undefined });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
      expect(result.pattern).toBe("");
    });

    it("returns first detected spam (not highest)", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() =>
          Promise.resolve([
            "msg-1:ch-1",
            "msg-2:ch-1",
            "msg-3:ch-1",
            "msg-4:ch-1",
            "msg-5:ch-1",
            "msg-6:ch-1",
          ]),
        ),
        rateLimit: vi.fn(() => Promise.resolve(false)),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({
        content: "SPAM MESSAGE IN ALL CAPS!!",
        mentions: { users: { size: 5 } },
      });
      const result = await service.evaluate(message);

      // Returns the first detected spam (rateLimit is checked first)
      expect(result.isSpam).toBe(true);
      expect(result.pattern).toBe("rateLimit");
    });
  });

  describe("checkCapsSpam", () => {
    it("ignores short messages", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "HI" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
    });

    it("ignores messages with no alphabetic chars", async () => {
      const valkey = createMockValkeyClient({
        sortedSetRangeByScore: vi.fn(() => Promise.resolve([])),
      });
      service = new AntiSpamService(valkey);

      const message = createMockMessage({ content: "1234567890!@#$%" });
      const result = await service.evaluate(message);

      expect(result.isSpam).toBe(false);
    });

    it("recognizes uppercase laughter-only content", () => {
      expect(isUppercaseLaughterOnly("JAJAJAJA")).toBe(true);
      expect(isUppercaseLaughterOnly("HAHAHAHA")).toBe(true);
      expect(isUppercaseLaughterOnly("AJAJJAJJJJAJAA")).toBe(true);
    });

    it("keeps genuine shouting eligible for caps spam", () => {
      expect(getCapsRatio("CALLATE AHORA MISMO")).toBeGreaterThan(0.7);
      expect(isUppercaseLaughterOnly("CALLATE AHORA MISMO")).toBe(false);
      expect(isCapsSpamContent("CALLATE AHORA MISMO")).toBe(true);
    });

    it("keeps normal mixed or lowercase messages out of caps spam", () => {
      expect(getCapsRatio("Hola che, todo bien?")).toBeLessThanOrEqual(0.7);
      expect(isCapsSpamContent("Hola che, todo bien?")).toBe(false);
      expect(isCapsSpamContent("jajaja todo normal")).toBe(false);
    });
  });
});
