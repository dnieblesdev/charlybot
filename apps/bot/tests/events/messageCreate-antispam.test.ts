import { beforeEach, describe, expect, it, vi } from "vitest";
import { Collection } from "discord.js";
import type { Message } from "discord.js";

const mockGetCachedByGuildId = vi.fn();
const mockEvaluate = vi.fn();
const mockGetGuildConfig = vi.fn();
const mockGetXPConfig = vi.fn();
const mockGetValkeyClient = vi.fn(() => ({ get: vi.fn(), set: vi.fn() }));

const mockAntiSpamServiceConstructor = vi.fn(function (_valkey: unknown, _config: unknown) {
  return {
    evaluate: mockEvaluate,
    applyAction: vi.fn(),
  };
});

vi.mock("../../src/app/services/AntiSpamService.ts", () => ({
  AntiSpamService: mockAntiSpamServiceConstructor,
}));

vi.mock("../../src/config/repositories/AntiSpamConfigRepo.ts", () => ({
  getCachedByGuildId: (...args: unknown[]) => mockGetCachedByGuildId(...args),
}));

vi.mock("../../src/config/repositories/GuildConfigRepo.ts", () => ({
  getGuildConfig: (...args: unknown[]) => mockGetGuildConfig(...args),
}));

vi.mock("../../src/config/repositories/XPRepo", () => ({
  getXPConfig: (...args: unknown[]) => mockGetXPConfig(...args),
  getUserXP: vi.fn(),
  incrementUserXP: vi.fn(),
  getLevelRoles: vi.fn(),
}));

vi.mock("../../src/infrastructure/valkey/index.ts", () => ({
  getValkeyClient: (...args: unknown[]) => mockGetValkeyClient(...args),
}));

vi.mock("../../src/config/repositories/modCaseRepository.ts", () => ({}));
vi.mock("../../src/app/services/ModLogService.ts", () => ({ logModAction: vi.fn() }));
vi.mock("../../src/utils/attachmentValidator.ts", () => ({ isValidImageAttachment: vi.fn(() => false) }));
vi.mock("../../src/utils/logger.ts", () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const messageCreateEvent = (await import("../../src/app/events/messageCreate.ts")).default;

function createMessage(): Message {
  return {
    author: { bot: false, id: "user-1", username: "User One" },
    attachments: new Collection(),
    channel: { id: "channel-1" },
    client: { channels: { fetch: vi.fn() } },
    content: "hello there",
    guild: { id: "guild-1", channels: { cache: new Collection() } },
    guildId: "guild-1",
    member: null,
  } as unknown as Message;
}

describe("messageCreate anti-spam config resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate.mockResolvedValue({ action: "warn", isSpam: false, pattern: "", reason: "" });
    mockGetGuildConfig.mockResolvedValue(null);
    mockGetXPConfig.mockResolvedValue(null);
  });

  it("skips anti-spam evaluation when canonical config is disabled", async () => {
    mockGetCachedByGuildId.mockResolvedValue({ enabled: false });

    await messageCreateEvent.execute(createMessage());

    expect(mockGetCachedByGuildId).toHaveBeenCalledWith("guild-1");
    expect(mockAntiSpamServiceConstructor).not.toHaveBeenCalled();
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it("uses the explicit default when no anti-spam config exists", async () => {
    mockGetCachedByGuildId.mockResolvedValue(null);

    await messageCreateEvent.execute(createMessage());

    expect(mockGetCachedByGuildId).toHaveBeenCalledWith("guild-1");
    expect(mockAntiSpamServiceConstructor).toHaveBeenCalledTimes(1);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
  });
});
