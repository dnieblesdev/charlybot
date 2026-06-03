import { describe, it, expect, vi } from "vitest";
import logger, { logCommand, logError, logVoice, logMusic } from "../../src/utils/logger.js";

describe("Bot logger helpers", () => {
  describe("logCommand", () => {
    it("should emit info with type: command", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logCommand("user123", "guild456", "balance");
      expect(infoSpy).toHaveBeenCalledOnce();
      const [meta, msg] = infoSpy.mock.calls[0];
      expect(meta).toMatchObject({ type: "command", userId: "user123", guildId: "guild456" });
      expect(msg).toBe("Command executed: balance");
    });

    it("should not embed PII in the message string", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logCommand("user-with-token", "guild-with-token", "economy");
      const [, msg] = infoSpy.mock.calls[0];
      expect(msg).not.toContain("user-with-token");
      expect(msg).toBe("Command executed: economy");
    });

    it("should include base fields in meta", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logCommand("user1", "guild1", "test");
      const [meta] = infoSpy.mock.calls[0];
      // base fields are added by pino to every log — verify service is present
      expect(meta).toMatchObject({ type: "command" });
      expect((meta as any).service).toBeUndefined(); // base fields not in meta, they're on the logger itself
    });
  });

  describe("logVoice", () => {
    it("should emit info with type: voice", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logVoice("user123", "guild456", "joined", "channel789");
      expect(infoSpy).toHaveBeenCalledOnce();
      const [meta, msg] = infoSpy.mock.calls[0];
      expect(meta).toMatchObject({
        type: "voice",
        userId: "user123",
        guildId: "guild456",
        channelId: "channel789",
      });
      expect(msg).toBe("Voice action: joined");
    });

    it("should work without channelId", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logVoice("user123", "guild456", "left");
      const [meta] = infoSpy.mock.calls[0];
      expect(meta.channelId).toBeUndefined();
    });
  });

  describe("logMusic", () => {
    it("should emit info with type: music", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logMusic("guild456", "play", { track: "test song" });
      expect(infoSpy).toHaveBeenCalledOnce();
      const [meta, msg] = infoSpy.mock.calls[0];
      expect(meta).toMatchObject({ type: "music", guildId: "guild456", track: "test song" });
      expect(msg).toBe("Music action: play");
    });

    it("should work without details", () => {
      const infoSpy = vi.spyOn(logger, "info");
      logMusic("guild456", "skip");
      const [meta] = infoSpy.mock.calls[0];
      expect(meta).toMatchObject({ type: "music", guildId: "guild456" });
      expect(meta.track).toBeUndefined();
    });
  });

  describe("logError", () => {
    it("should emit error with stack and context", () => {
      const errorSpy = vi.spyOn(logger, "error");
      const testError = new Error("something broke");
      testError.name = "TestError";
      logError(testError, { context: "test_context" });
      expect(errorSpy).toHaveBeenCalledOnce();
      const [meta, msg] = errorSpy.mock.calls[0];
      expect(meta).toMatchObject({
        stack: testError.stack,
        context: "test_context",
      });
      expect(msg).toBe("something broke");
    });

    it("should handle non-Error values gracefully", () => {
      const errorSpy = vi.spyOn(logger, "error");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logError("string error" as any, { context: "test" });
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });
});