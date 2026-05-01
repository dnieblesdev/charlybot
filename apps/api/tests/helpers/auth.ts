import { signAccessToken } from "../../src/auth/jwt";
import type { JwtPayload } from "../../src/auth/jwt.types";

/**
 * Default test user payload for JWT tokens in tests.
 */
export const TEST_USER_PAYLOAD: JwtPayload = {
  userId: "test-user-id",
  username: "testuser",
  avatar: null,
  guilds: ["test-guild-api"],
};

/**
 * Generate a valid test JWT token with optional custom payload.
 */
export async function createTestToken(payload: Partial<JwtPayload> = {}): Promise<string> {
  const mergedPayload: JwtPayload = {
    ...TEST_USER_PAYLOAD,
    ...payload,
  };
  return signAccessToken(mergedPayload);
}

/**
 * Create a cookie string for the access token (ready to send in request).
 * Optionally include additional guild IDs the user should have access to.
 */
export async function getAuthCookie(additionalGuilds: string[] = []): Promise<string> {
  const token = await createTestToken({
    guilds: [...TEST_USER_PAYLOAD.guilds, ...additionalGuilds],
  });
  return `accessToken=${token}`;
}