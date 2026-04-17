export interface FilteredGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface AuthUser {
  userId: string;
  username: string;
  avatar: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  userId: string;
  username: string;
  avatar: string | null;
  guilds: FilteredGuild[];
}
