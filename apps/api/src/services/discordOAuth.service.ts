import { randomBytes } from "node:crypto";
import type { DiscordUser, DiscordGuild, FilteredGuild } from "../auth/jwt.types";
import { getValkeyClient } from "../infrastructure/valkey";
import { prisma } from "@charlybot/shared";

const DISCORD_API_BASE = "https://discord.com/api/v10";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Exchange an OAuth2 code for access + refresh tokens
 */
async function exchangeCode(code: string): Promise<TokenResponse> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Discord OAuth2 environment variables not configured");
  }

  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord token exchange failed: ${response.status} - ${errorBody}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Fetch the authenticated user's Discord profile
 */
async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord user fetch failed: ${response.status} - ${errorBody}`);
  }

  return response.json() as Promise<DiscordUser>;
}

/**
 * Fetch the authenticated user's guilds
 */
async function fetchGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Discord guilds fetch failed: ${response.status} - ${errorBody}`);
  }

  return response.json() as Promise<DiscordGuild[]>;
}

/**
 * Permission bit flags for admin/managing
 * ADMINISTRATOR = 0x8 (8)
 * MANAGE_GUILD = 0x20 (32)
 */
function hasAdminPermissions(permissions: string): boolean {
  const perms = parseInt(permissions, 10);
  return (perms & 0x8) !== 0 || (perms & 0x20) !== 0;
}

/**
 * Filter guilds where:
 * 1. The bot is present in the guild (checked via Prisma)
 * 2. The user has ADMINISTRATOR or MANAGE_GUILD permissions
 */
export async function filterAdminGuilds(
  guilds: DiscordGuild[],
  botGuildIds: string[],
): Promise<FilteredGuild[]> {
  const allowedGuildIds = new Set(botGuildIds);

  return guilds
    .filter((guild) => {
      if (!allowedGuildIds.has(guild.id)) return false;
      return hasAdminPermissions(guild.permissions);
    })
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
    }));
}

/**
 * Get all guild IDs where the bot is present (from Prisma)
 */
async function getBotGuildIds(): Promise<string[]> {
  const guilds = await prisma.guild.findMany({
    select: { guildId: true },
  });
  return guilds.map((g) => g.guildId);
}

/**
 * Full OAuth2 flow: exchange code and return user + filtered guilds + tokens
 */
export async function exchangeCodeAndFetchProfile(
  code: string,
): Promise<{ user: DiscordUser; guilds: FilteredGuild[]; accessToken: string; refreshToken: string }> {
  // Exchange code for tokens
  const tokenResponse = await exchangeCode(code);

  // Fetch user and guilds in parallel
  const [user, rawGuilds] = await Promise.all([
    fetchUser(tokenResponse.access_token),
    fetchGuilds(tokenResponse.access_token),
  ]);

  // Get bot's guild IDs from Prisma
  const botGuildIds = await getBotGuildIds();

  // Filter guilds
  const filteredGuilds = await filterAdminGuilds(rawGuilds, botGuildIds);

  // Debug logging
  const mod = await import("../utils/logger");
  const log = mod.default;
  log.info("Discord guilds debug", {
    rawGuildCount: rawGuilds.length,
    botGuildCount: botGuildIds.length,
    filteredCount: filteredGuilds.length,
    rawGuildIds: rawGuilds.map(g => g.id).slice(0, 5),
    botGuildIds: botGuildIds.slice(0, 5),
  });

  return {
    user,
    guilds: filteredGuilds,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
  };
}

/**
 * Store temporary OAuth state in Valkey (5 minute TTL)
 */
export async function storeOAuthState(state: string): Promise<void> {
  const valkey = getValkeyClient();
  await valkey.set(`cb:oauth:state:${state}`, true, 300);
}

/**
 * Validate and consume OAuth state from Valkey
 * Returns true if state is valid and was deleted
 */
export async function consumeOAuthState(state: string): Promise<boolean> {
  const valkey = getValkeyClient();
  const key = `cb:oauth:state:${state}`;
  const exists = await valkey.get<boolean>(key);

  if (!exists) {
    return false;
  }

  // Delete the state (one-time use)
  await valkey.del(key);
  return true;
}

/**
 * Generate random state string for OAuth CSRF protection
 */
export function generateState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Build Discord OAuth2 authorization URL
 */
export function buildDiscordAuthUrl(state: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Discord OAuth2 environment variables not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state,
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}