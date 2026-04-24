import { Hono } from "hono";
import { authMiddleware } from "./middleware/authMiddleware";
import { rateLimitMiddleware } from "./middleware/rateLimitMiddleware";
import logger, { sanitizeUrlPath } from "./utils/logger";
import { prisma } from "@charlybot/shared";
import guildRoutes from "./routes/guilds";
import economyRoutes from "./routes/economy";
import xpRoutes from "./routes/xp";
import autoroleRoutes from "./routes/autoroles";
import verificationRoutes from "./routes/verifications";
import classRoutes from "./routes/classes";
import musicRoutes from "./routes/music";
import authRoutes from "./routes/auth";
import { initializeValkey, shutdownValkey } from "./infrastructure/valkey";

const app = new Hono();

// Custom Logger Middleware - log path only, not full URL
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  // Sanitize URL to log path only (strips query params with sensitive data)
  const sanitizedPath = sanitizeUrlPath(c.req.url);
  logger.info(`${c.req.method} ${sanitizedPath} - ${c.res.status} [${ms}ms]`);
});

// Public liveness health check (no DB/Valkey)
app.get("/health", async (c) => {
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount auth routes BEFORE auth middleware (they are public)
app.route("/api/v1/auth", authRoutes);

// Protected routes - auth + rate limiting (applied to remaining /api/* routes)
app.use("/api/*", authMiddleware);
app.use("/api/*", rateLimitMiddleware);

app.route("/api/v1/guilds", guildRoutes);
app.route("/api/v1/economy", economyRoutes);
app.route("/api/v1/xp", xpRoutes);
app.route("/api/v1/autoroles", autoroleRoutes);
app.route("/api/v1/verifications", verificationRoutes);
app.route("/api/v1/classes", classRoutes);
app.route("/api/v1/music", musicRoutes);

app.get("/api/v1/ping", (c) => {
  return c.json({ message: "pong", timestamp: new Date().toISOString() });
});

// Auth-protected readiness health check (with DB/Valkey)
app.get("/api/v1/health", async (c) => {
  let dbStatus = "ok";
  let valkeyStatus = "ok";

  try {
    // DB check
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.error("Database health check failed", { error });
    dbStatus = "error";
  }

  try {
    // Valkey check with explicit ping timeout
    const { getValkeyClient } = await import("./infrastructure/valkey");
    const valkey = getValkeyClient();
    if (!valkey.isConnected()) {
      valkeyStatus = "disconnected";
    } else {
      // Valkey is connected, status is ok
      valkeyStatus = "ok";
    }
  } catch (error) {
    logger.warn("Valkey health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    valkeyStatus = "degraded";
  }

  const overallStatus = dbStatus === "ok" && valkeyStatus === "ok" ? "ok" : "degraded";

  return c.json({
    status: overallStatus,
    database: dbStatus,
    valkey: valkeyStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, overallStatus === "ok" ? 200 : 503);
});

// Initialize Valkey before starting server
await initializeValkey();

logger.info("Charly API starting...");

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
