import { getValkeyClient } from "../infrastructure/valkey";
import type { AuthSession } from "./jwt.types";

const SESSION_PREFIX = "cb:user:session:";
const REFRESH_PREFIX = "cb:user:refresh:";
const SESSION_TTL = 604800; // 7 days in seconds
const REFRESH_TTL = 604800; // 7 days in seconds

/**
 * Store a user session in Valkey
 */
export async function setSession(
  userId: string,
  session: AuthSession,
): Promise<void> {
  const valkey = getValkeyClient();
  const key = `${SESSION_PREFIX}${userId}`;
  await valkey.set(key, session, SESSION_TTL);
}

/**
 * Retrieve a user session from Valkey
 */
export async function getSession(userId: string): Promise<AuthSession | null> {
  const valkey = getValkeyClient();
  const key = `${SESSION_PREFIX}${userId}`;
  const session = await valkey.get<AuthSession>(key);
  return session ?? null;
}

/**
 * Delete a user session from Valkey
 */
export async function deleteSession(userId: string): Promise<void> {
  const valkey = getValkeyClient();
  const key = `${SESSION_PREFIX}${userId}`;
  await valkey.del(key);
}

/**
 * Store a refresh token mapping to userId
 */
export async function setRefreshToken(
  token: string,
  userId: string,
): Promise<void> {
  const valkey = getValkeyClient();
  const key = `${REFRESH_PREFIX}${token}`;
  await valkey.set(key, userId, REFRESH_TTL);
}

/**
 * Get userId from a refresh token
 */
export async function getRefreshTokenUserId(
  token: string,
): Promise<string | null> {
  const valkey = getValkeyClient();
  const key = `${REFRESH_PREFIX}${token}`;
  const userId = await valkey.get<string>(key);
  return userId ?? null;
}

/**
 * Delete a refresh token
 */
export async function deleteRefreshToken(token: string): Promise<void> {
  const valkey = getValkeyClient();
  const key = `${REFRESH_PREFIX}${token}`;
  await valkey.del(key);
}