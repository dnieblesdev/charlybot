import { Hono } from "hono";
import { authMiddleware } from "./middleware/authMiddleware";
import logger from "./utils/logger";
import { prisma } from "@charlybot/shared";
import guildRoutes from "./routes/guilds";
import economyRoutes from "./routes/economy";
import xpRoutes from "./routes/xp";
import autoroleRoutes from "./routes/autoroles";
import verificationRoutes from "./routes/verifications";
import classRoutes from "./routes/classes";
import musicRoutes from "./routes/music";
import { initializeValkey, shutdownValkey } from "./infrastructure/valkey";

const app = new Hono();

// Custom Logger Middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info(`${c.req.method} ${c.req.url} - ${c.res.status} [${ms}ms]`);
});

// Health check (Public)
app.get("/health", async (c) => {
  let dbStatus = "ok";
  try {
    // Simple query to check prisma connection
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.error("Database health check failed", { error });
    dbStatus = "error";
  }

  return c.json({
    status: "ok",
    database: dbStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Protected routes
app.use("/api/*", authMiddleware);

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

// Initialize Valkey before starting server
await initializeValkey();

logger.info("Charly API starting...");

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
