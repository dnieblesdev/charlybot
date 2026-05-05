import type { ChatInputCommandInteraction, Guild, User, MessageFlags } from "discord.js";

export interface MockInteractionOptions {
  subcommand?: string;
  subcommandGroup?: string | null;
  stringOption?: string;
  integerOption?: number;
  userOption?: { id: string; username: string; bot: boolean };
}

export interface MockChatInputCommandInteraction {
  reply: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
  deferReply: ReturnType<typeof vi.fn>;
  followUp: ReturnType<typeof vi.fn>;
  options: {
    getSubcommand: ReturnType<typeof vi.fn>;
    getSubcommandGroup: ReturnType<typeof vi.fn>;
    getString: ReturnType<typeof vi.fn>;
    getInteger: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
  };
  user: {
    id: string;
    username: string;
    bot: boolean;
  };
  guildId: string;
  guild: Partial<Guild>;
  deferred: boolean;
  replied: boolean;
  customId: string | null;
  commandName: string;
  commandType: number;
}

function createResolvedPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

export function createMockChatInputCommandInteraction(
  overrides?: {
    userId?: string;
    guildId?: string;
    options?: MockInteractionOptions;
  },
): MockChatInputCommandInteraction {
  const userId = overrides?.userId ?? "user-123";
  const guildId = overrides?.guildId ?? "guild-456";
  const opts = overrides?.options ?? {};

  const mockUser: User = {
    id: userId,
    username: opts.userOption?.username ?? "TestUser",
    bot: opts.userOption?.bot ?? false,
  } as User;

  const mockGuild = {
    id: guildId,
  } as unknown as Partial<Guild>;

  const interaction: MockChatInputCommandInteraction = {
    reply: vi.fn(() => createResolvedPromise(undefined)),
    editReply: vi.fn(() => createResolvedPromise(undefined)),
    deferReply: vi.fn(() => {
      interaction.deferred = true;
      return createResolvedPromise(undefined);
    }),
    followUp: vi.fn(() => createResolvedPromise(undefined)),
    options: {
      getSubcommand: vi.fn(() => opts.subcommand ?? null),
      getSubcommandGroup: vi.fn(() => opts.subcommandGroup ?? null),
      getString: vi.fn(() => opts.stringOption ?? null),
      getInteger: vi.fn(() => opts.integerOption ?? null),
      getUser: vi.fn(() => opts.userOption ?? null),
    },
    user: {
      id: userId,
      username: opts.userOption?.username ?? "TestUser",
      bot: opts.userOption?.bot ?? false,
    },
    guildId,
    guild: mockGuild as unknown as Partial<Guild>,
    deferred: false,
    replied: false,
    customId: null,
    commandName: "test-command",
    commandType: 1,
  };

  return interaction;
}

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "user-123",
    username: "TestUser",
    bot: false,
    ...overrides,
  } as User;
}

export function createMockGuild(overrides?: Partial<Guild>): Guild {
  return {
    id: "guild-456",
    ...overrides,
  } as Guild;
}
