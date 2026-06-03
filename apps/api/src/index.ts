import { Hono } from "hono";
import { authMiddleware } from "./middleware/authMiddleware";
import { rateLimitMiddleware } from "./middleware/rateLimitMiddleware";
import { requestId } from "./middleware/requestId";
import { accessLog } from "./middleware/accessLog";
import logger from "./utils/logger";
import { createMetricsRegistry } from "@charlybot/shared";
import { prisma } from "@charlybot/shared";
import guildRoutes from "./routes/guilds";
import authRoutes from "./routes/auth";
import economyRoutes from "./routes/economy.routes";
import xpRoutes from "./routes/xp.routes";
import musicRoutes from "./routes/music.routes";
import verificationsRoutes from "./routes/verifications.routes";
import autorolesRoutes from "./routes/autoroles.routes";
import classesRoutes from "./routes/classes.routes";
import { initializeValkey } from "./infrastructure/valkey";

const app = new Hono();

// requestId middleware MUST run FIRST — attaches child logger with request_id to context
app.use(requestId);

// accessLog middleware runs AFTER requestId — emits http_access structured log
app.use(accessLog);

// Global error handler — catches route crashes, logs unhandled_exception, returns sanitised JSON
app.onError((err, c) => {
  const reqLogger = c.get("logger") ?? logger;
  reqLogger.fatal(
    {
      type: "unhandled_exception",
      request_id: (reqLogger as any)?.bindings?.request_id,
      error_message: err.message,
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
      }),
    },
    "Unhandled exception in route"
  );
  return c.json({ error: "Internal server error" }, 500);
});

// Public liveness health check (no DB/Valkey)
app.get("/health", async (c) => {
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Public metrics endpoint
const { register: apiRegister } = createMetricsRegistry();
app.get("/metrics", async (c) => {
  c.header("Content-Type", apiRegister.contentType);
  return c.body(await apiRegister.metrics());
});

// Mount auth routes BEFORE auth middleware (they are public)
app.route("/api/v1/auth", authRoutes);

// Protected routes - auth + rate limiting (applied to remaining /api/* routes)
app.use("/api/*", authMiddleware);
app.use("/api/*", rateLimitMiddleware);

app.route("/api/v1/guilds", guildRoutes);
app.route("/api/v1/economy", economyRoutes);
app.route("/api/v1/xp", xpRoutes);
app.route("/api/v1/music", musicRoutes);
app.route("/api/v1/verifications", verificationsRoutes);
app.route("/api/v1/autoroles", autorolesRoutes);
app.route("/api/v1/classes", classesRoutes);

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
    logger.error({ error }, "Database health check failed");
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
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Valkey health check failed"
    );
    valkeyStatus = "degraded";
  }

  const overallStatus =
    dbStatus === "ok" && valkeyStatus === "ok" ? "ok" : "degraded";

  return c.json(
    {
      status: overallStatus,
      database: dbStatus,
      valkey: valkeyStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    overallStatus === "ok" ? 200 : 503
  );
});

// Initialize Valkey before starting server
await initializeValkey();

const port = Number(process.env.PORT) || 3000;

logger.info("Charly API starting...");

// Node.js server — Bun's export default { port, fetch } auto-start doesn't work with tsx
import { serve } from "@hono/node-server";
serve({ fetch: app.fetch, port });

logger.info(`Charly API running on port ${port}`);

// Export for testability
export { app };
