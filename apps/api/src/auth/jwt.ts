import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload } from "./jwt.types";

const ALGORITHM = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign an access token with 1-hour expiry
 */
export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

/**
 * Sign a refresh token with 7-day expiry (only userId in payload)
 */
export async function signRefreshToken(userId: string): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Verify an access token and return the payload, or null if invalid
 */
export async function verifyAccessToken(
  token: string,
): Promise<JwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}