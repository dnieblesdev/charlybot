import { describe, it, expect } from "vitest";
import {
  getByGuildId,
  create,
  update,
} from "../../src/config/repositories/AntiSpamConfigRepo";
import {
  create as createHistory,
  countRecentByUser,
  getRecentByUser,
} from "../../src/config/repositories/AntiSpamHistoryRepo";

describe("AntiSpamRepos", () => {
  describe("AntiSpamConfigRepo", () => {
    describe("getByGuildId", () => {
      it("should be a function", () => {
        expect(typeof getByGuildId).toBe("function");
      });
    });

    describe("create", () => {
      it("should be a function", () => {
        expect(typeof create).toBe("function");
      });

      it("should throw if guildId is missing", () => {
        expect(() => create({})).toThrow("guildId is required");
      });
    });

    describe("update", () => {
      it("should be a function", () => {
        expect(typeof update).toBe("function");
      });
    });
  });

  describe("AntiSpamHistoryRepo", () => {
    describe("create", () => {
      it("should be a function", () => {
        expect(typeof createHistory).toBe("function");
      });
    });

    describe("countRecentByUser", () => {
      it("should be a function", () => {
        expect(typeof countRecentByUser).toBe("function");
      });
    });

    describe("getRecentByUser", () => {
      it("should be a function", () => {
        expect(typeof getRecentByUser).toBe("function");
      });
    });
  });
});