import { describe, it, expect } from "vitest";
import { MusicQueueItemSchema, MusicQueueSchema, GuildMusicConfigSchema } from "@charlybot/shared";

describe("Music Queue Item Schema Validation", () => {
  it("T6.3: should accept valid queue item", () => {
    const validData = {
      id: "item-123",
      queueId: "queue-456",
      title: "Test Song",
      url: "https://youtube.com/watch?v=abc123",
      duration: 180,
      position: 0,
      requesterId: "user-789",
      requesterName: "TestUser",
    };

    const result = MusicQueueItemSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.3b: should reject invalid URL", () => {
    const invalidData = {
      queueId: "queue-456",
      title: "Test Song",
      url: "not-a-url",
      duration: 180,
      position: 0,
      requesterId: "user-789",
      requesterName: "TestUser",
    };

    const result = MusicQueueItemSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("T6.3c: should reject negative duration", () => {
    const invalidData = {
      queueId: "queue-456",
      title: "Test Song",
      url: "https://youtube.com/watch?v=abc",
      duration: -10,
      position: 0,
      requesterId: "user-789",
      requesterName: "TestUser",
    };

    const result = MusicQueueItemSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("Music Queue Schema Validation", () => {
  it("T6.4: should accept valid queue settings", () => {
    const validData = {
      guildId: "guild-123",
      volume: 75,
      isPlaying: true,
      isPaused: false,
      loopMode: "queue" as const,
    };

    const result = MusicQueueSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.4b: should reject invalid loop mode", () => {
    const invalidData = {
      guildId: "guild-123",
      loopMode: "invalid-mode",
    };

    const result = MusicQueueSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("T6.4c: should reject volume over 200", () => {
    const invalidData = {
      guildId: "guild-123",
      volume: 250,
    };

    const result = MusicQueueSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe("Guild Music Config Schema Validation", () => {
  it("T6.5: should accept valid music config", () => {
    const validData = {
      guildId: "guild-123",
      defaultVolume: 60,
      autoCleanup: true,
      maxQueueSize: 500,
    };

    const result = GuildMusicConfigSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("T6.5b: should reject invalid maxQueueSize", () => {
    const invalidData = {
      guildId: "guild-123",
      maxQueueSize: 0, // Must be at least 1
    };

    const result = GuildMusicConfigSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
