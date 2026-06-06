import { describe, it, expect } from "vitest";
import { RouletteService } from "../../src/app/services/economy/RouletteService.js";

describe("RouletteService", () => {
  describe("getNumberColor", () => {
    it("should return green emoji for number 0", () => {
      expect(RouletteService.getNumberColor(0)).toBe("🟢");
    });

    it("should return red emoji for red numbers", () => {
      // Red numbers: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      for (const num of redNumbers) {
        expect(RouletteService.getNumberColor(num)).toBe("🔴");
      }
    });

    it("should return black emoji for black numbers", () => {
      // Black numbers: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
      const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
      for (const num of blackNumbers) {
        expect(RouletteService.getNumberColor(num)).toBe("⚫");
      }
    });

    it("should return question mark for invalid numbers", () => {
      // Numbers outside 0-36
      expect(RouletteService.getNumberColor(-1)).toBe("❓");
      expect(RouletteService.getNumberColor(37)).toBe("❓");
      expect(RouletteService.getNumberColor(100)).toBe("❓");
      expect(RouletteService.getNumberColor(-100)).toBe("❓");
    });

    it("should handle edge case 36 (red)", () => {
      expect(RouletteService.getNumberColor(36)).toBe("🔴");
    });

    it("should handle edge case 35 (black)", () => {
      expect(RouletteService.getNumberColor(35)).toBe("⚫");
    });
  });

  describe("validateBet", () => {
    describe("color bets", () => {
      it("should accept valid color bets (case-insensitive)", () => {
        expect(RouletteService.validateBet("color", "red")).toBe(true);
        expect(RouletteService.validateBet("color", "black")).toBe(true);
        expect(RouletteService.validateBet("color", "green")).toBe(true);
      });

      it("should accept color bets case-insensitively", () => {
        expect(RouletteService.validateBet("color", "RED")).toBe(true);
        expect(RouletteService.validateBet("color", "Black")).toBe(true);
        expect(RouletteService.validateBet("color", "GREEN")).toBe(true);
      });

      it("should reject invalid color bets", () => {
        expect(RouletteService.validateBet("color", "blue")).toBe(false);
        expect(RouletteService.validateBet("color", "yellow")).toBe(false);
        expect(RouletteService.validateBet("color", "redblue")).toBe(false);
        expect(RouletteService.validateBet("color", "")).toBe(false);
      });
    });

    describe("number bets", () => {
      it("should accept valid number bets 0-36", () => {
        for (let i = 0; i <= 36; i++) {
          expect(RouletteService.validateBet("number", String(i))).toBe(true);
        }
      });

      it("should reject out-of-range numbers", () => {
        expect(RouletteService.validateBet("number", "37")).toBe(false);
        expect(RouletteService.validateBet("number", "100")).toBe(false);
        expect(RouletteService.validateBet("number", "-1")).toBe(false);
        expect(RouletteService.validateBet("number", "-100")).toBe(false);
      });

      it("should reject non-numeric strings", () => {
        expect(RouletteService.validateBet("number", "abc")).toBe(false);
        expect(RouletteService.validateBet("number", "")).toBe(false);
      });

      it("should reject malformed numeric strings while accepting valid bounds", () => {
        expect(RouletteService.validateBet("number", "0")).toBe(true);
        expect(RouletteService.validateBet("number", "36")).toBe(true);
        expect(RouletteService.validateBet("number", "1.5")).toBe(false);
        expect(RouletteService.validateBet("number", "1abc")).toBe(false);
        expect(RouletteService.validateBet("number", "37")).toBe(false);
      });
    });

    describe("unknown betType", () => {
      it("should reject unknown bet types", () => {
        expect(RouletteService.validateBet("parlay", "red")).toBe(false);
        expect(RouletteService.validateBet("even", "2")).toBe(false);
        expect(RouletteService.validateBet("", "red")).toBe(false);
      });
    });
  });
});
