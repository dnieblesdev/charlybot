import { describe, it, expect } from "vitest";
const { formatWelcomeMessage } = await import(
  "../../../src/app/events/guildMemberAdd.js"
);

describe("formatWelcomeMessage", () => {
  // Mock GuildMember with required properties
  const mockMember = {
    id: "123",
    user: { username: "TestUser" },
    guild: { name: "TestServer" },
    toString: () => "<@123>",
  } as unknown as import("discord.js").GuildMember;

  describe("basic placeholders", () => {
    it("replaces {user} with mention", () => {
      const result = formatWelcomeMessage("Welcome {user}", mockMember, new Map());
      expect(result).toBe("Welcome <@123>");
    });

    it("replaces {username} with user username", () => {
      const result = formatWelcomeMessage("Hello {username}", mockMember, new Map());
      expect(result).toBe("Hello TestUser");
    });

    it("replaces {server} with guild name", () => {
      const result = formatWelcomeMessage("Join {server}", mockMember, new Map());
      expect(result).toBe("Join TestServer");
    });
  });

  describe("social link placeholders", () => {
    it("replaces {enlace_twitch} with URL from map", () => {
      const links = new Map<string, string>([["twitch", "https://twitch.tv/c"]]);
      const result = formatWelcomeMessage(
        "Watch us: {enlace_twitch}",
        mockMember,
        links,
      );
      expect(result).toBe("Watch us: https://twitch.tv/c");
    });

    it("replaces multiple social link placeholders", () => {
      const links = new Map<string, string>([
        ["twitch", "https://twitch.tv/c"],
        ["youtube", "https://youtube.com/@charlybot"],
      ]);
      const result = formatWelcomeMessage(
        "Twitch: {enlace_twitch} | YouTube: {enlace_youtube}",
        mockMember,
        links,
      );
      expect(result).toBe("Twitch: https://twitch.tv/c | YouTube: https://youtube.com/@charlybot");
    });

    it("unknown platform renders as literal placeholder", () => {
      const links = new Map<string, string>();
      const result = formatWelcomeMessage(
        "Check: {enlace_unknown}",
        mockMember,
        links,
      );
      expect(result).toBe("Check: {enlace_unknown}");
    });

    it("empty map renders unknown platform as literal", () => {
      const links = new Map<string, string>();
      const result = formatWelcomeMessage(
        "Twitch: {enlace_twitch}",
        mockMember,
        links,
      );
      expect(result).toBe("Twitch: {enlace_twitch}");
    });

    it("known platform takes precedence over missing key in map", () => {
      const links = new Map<string, string>([["twitch", "https://twitch.tv/c"]]);
      const result = formatWelcomeMessage(
        "Twitch: {enlace_twitch} | Kick: {enlace_kick}",
        mockMember,
        links,
      );
      expect(result).toBe("Twitch: https://twitch.tv/c | Kick: {enlace_kick}");
    });
  });

  describe("mixed placeholders", () => {
    it("combines basic and social link placeholders", () => {
      const links = new Map<string, string>([["twitch", "https://twitch.tv/c"]]);
      const result = formatWelcomeMessage(
        "Welcome {user} to {server}! Our twitch: {enlace_twitch}",
        mockMember,
        links,
      );
      expect(result).toBe(
        "Welcome <@123> to TestServer! Our twitch: https://twitch.tv/c",
      );
    });

    it("handles all placeholders missing simultaneously", () => {
      const links = new Map<string, string>();
      const result = formatWelcomeMessage(
        "{user} joined {server}. Social: {enlace_twitch} | {enlace_youtube}",
        mockMember,
        links,
      );
      expect(result).toBe(
        "<@123> joined TestServer. Social: {enlace_twitch} | {enlace_youtube}",
      );
    });
  });
});