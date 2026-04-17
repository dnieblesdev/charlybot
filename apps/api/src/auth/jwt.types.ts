export interface JwtPayload {
  userId: string;
  username: string;
  avatar: string | null;
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  avatar: string | null;
  discordAccessToken: string;
  discordRefreshToken: string;
  guilds: FilteredGuild[];
}

export interface FilteredGuild {
  id: string;
  name: string;
  icon: string | null;
}