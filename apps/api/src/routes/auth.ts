import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { jwtAuth } from "../middleware/jwtMiddleware";
import {
  signAccessToken,
  signRefreshToken,
} from "../auth/jwt";
import {
  setSession,
  getSession,
  deleteSession,
  setRefreshToken,
  getRefreshTokenUserId,
  deleteRefreshToken,
} from "../auth/sessionStore";
import {
  exchangeCodeAndFetchProfile,
  storeOAuthState,
  consumeOAuthState,
  generateState,
  buildDiscordAuthUrl,
  getBotGuildIds,
} from "../services/discordOAuth.service";
import type { AuthSession } from "../auth/jwt.types";
import logger from "../utils/logger";

const router = new Hono();

// GET /api/v1/auth/login - Redirect to Discord OAuth
router.get("/login", async (c) => {
  try {
    const state = generateState();
    await storeOAuthState(state);
    const authUrl = buildDiscordAuthUrl(state);
    logger.info("Redirecting to Discord OAuth");
    c.header("Location", authUrl);
    return c.body(null, 302);
  } catch (error) {
    logger.error("Failed to create OAuth login URL", { error });
    return c.json({ error: "Failed to initiate login" }, 500);
  }
});

// GET /api/v1/auth/callback - Exchange code for tokens
router.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    logger.warn("Missing code or state in callback", {
      hasCode: !!code,
      hasState: !!state,
    });
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  try {
    // Validate state (CSRF protection)
    const stateValid = await consumeOAuthState(state);
    if (!stateValid) {
      logger.warn("Invalid or expired OAuth state");
      return c.json({ error: "Invalid or expired state parameter" }, 400);
    }

    // Exchange code for user profile + guilds + tokens
    const { user, guilds, accessToken: discordAccessToken, refreshToken: discordRefreshToken } =
      await exchangeCodeAndFetchProfile(code);

    // Create session data
    const session: AuthSession = {
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      discordAccessToken,
      discordRefreshToken,
      guilds,
    };

    // Store session in Valkey
    await setSession(user.id, session);

    // Generate JWTs
    const accessToken = await signAccessToken({
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      guilds: guilds.map((g) => g.id),
    });

    const refreshToken = await signRefreshToken(user.id);

    // Store refresh token mapping
    await setRefreshToken(refreshToken, user.id);

    logger.info("User authenticated successfully", {
      userId: user.id,
      username: user.username,
      guildCount: guilds.length,
    });

    // Set HttpOnly cookies
    const isProduction = process.env.NODE_ENV === "production";
    setCookie(c, "accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });
    setCookie(c, "refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      path: "/",
      maxAge: 604800,
    });

    // Redirect to dashboard without tokens in URL
    c.header("Location", "/dashboard/auth/callback");
    return c.body(null, 302);
  } catch (error) {
    logger.error("OAuth callback failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: "Authentication failed" }, 500);
  }
});

// GET /api/v1/auth/me - Get current user profile (JWT protected)
router.get("/me", jwtAuth, async (c) => {
  const jwt = c.get("jwt");

  try {
    const session = await getSession(jwt.userId);

    if (!session) {
      logger.warn("Session not found for authenticated user", {
        userId: jwt.userId,
      });
      return c.json({ error: "Session expired or invalid" }, 401);
    }

    // Refresh JWT with current guilds to prevent stale 403 errors
    const botGuildIds = await getBotGuildIds();
    const currentGuilds = session.guilds.filter((g) =>
      botGuildIds.includes(g.id),
    );

    const newAccessToken = await signAccessToken({
      userId: session.userId,
      username: session.username,
      avatar: session.avatar,
      guilds: currentGuilds.map((g) => g.id),
    });

    const isProduction = process.env.NODE_ENV === "production";
    setCookie(c, "accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });

    return c.json({
      user: {
        userId: session.userId,
        username: session.username,
        avatar: session.avatar,
      },
      guilds: currentGuilds,
    });
  } catch (error) {
    logger.error("Failed to fetch user profile", { error, userId: jwt.userId });
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

// POST /api/v1/auth/refresh - Refresh access token
router.post("/refresh", async (c) => {
  const refreshToken = getCookie(c, "refreshToken");

  if (!refreshToken) {
    logger.warn("Missing refreshToken cookie");
    return c.json({ error: "Missing refreshToken cookie" }, 401);
  }

  try {
    // Look up userId from refresh token
    const userId = await getRefreshTokenUserId(refreshToken);

    if (!userId) {
      logger.warn("Invalid refresh token used");
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    // Get session to ensure user still exists
    const session = await getSession(userId);

    if (!session) {
      logger.warn("Session not found for refresh", { userId });
      return c.json({ error: "Session expired or invalid" }, 401);
    }

    // Generate new access token
    const accessToken = await signAccessToken({
      userId: session.userId,
      username: session.username,
      avatar: session.avatar,
      guilds: session.guilds.map((g) => g.id),
    });

    // Reset session TTL
    await setSession(userId, session);

    // Set new access token cookie
    const isProduction = process.env.NODE_ENV === "production";
    setCookie(c, "accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });

    logger.info("Access token refreshed", { userId });

    return c.body(null, 200);
  } catch (error) {
    logger.error("Token refresh failed", { error });
    return c.json({ error: "Failed to refresh token" }, 500);
  }
});

// POST /api/v1/auth/logout - Invalidate session (JWT protected)
router.post("/logout", jwtAuth, async (c) => {
  const jwt = c.get("jwt");

  try {
    // Delete session from Valkey
    await deleteSession(jwt.userId);

    // Revoke refresh token if provided in body
    const body = await c.req.json().catch(() => null);
    if (body && typeof body.refreshToken === "string") {
      await deleteRefreshToken(body.refreshToken);
    }

    // Clear cookies
    setCookie(c, "accessToken", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    setCookie(c, "refreshToken", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });

    logger.info("User logged out", { userId: jwt.userId });

    return c.json({ success: true });
  } catch (error) {
    logger.error("Logout failed", { error, userId: jwt.userId });
    return c.json({ error: "Logout failed" }, 500);
  }
});

export default router;