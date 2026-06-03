import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { GuildConfigSchema } from "@charlybot/shared";
import { z } from "zod";
import { logRouteError } from "../utils/logRouteError";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";

const GuildUpdateSchema = z.object({
  guildId: z.string().optional(),
  name: z.string().optional(),
  prefix: z.string().optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  MemberCount: z.number().optional(),
});

const router = new Hono();

// Apply guild access middleware to all guild-scoped routes
router.use("/:id/config", guildAccessMiddleware);
router.use("/:id", guildAccessMiddleware);

// GET /api/v1/guilds - List all registered guilds (debug/inspection)
router.get("/", async (c) => {
  const logger = c.get("logger");
  try {
    const guilds = await prisma.guild.findMany({
      select: {
        guildId: true,
        name: true,
        MemberCount: true,
        ownerId: true,
        ownerName: true,
      },
      orderBy: { guildId: "asc" },
    });

    return c.json({ count: guilds.length, guilds });
  } catch (error) {
    logRouteError(logger, { c, error, meta: { operation: "list_guilds" } });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/guilds/:id - Update Guild metadata
router.patch("/:id", zValidator("json", GuildUpdateSchema), async (c) => {
  const guildId = c.req.param("id");
  const data = c.req.valid("json");
  const logger = c.get("logger");

  try {
    const guild = await prisma.guild.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    return c.json(guild);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "update_guild" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/guilds/:id - Delete Guild and its config (idempotent, atomic)
router.delete("/:id", async (c) => {
  const guildId = c.req.param("id");
  const logger = c.get("logger");

  try {
    // Callback transaction: atomic + rollback on failure
    // deleteMany: idempotent — returns { count: 0 } if already gone
    await prisma.$transaction(async (tx) => {
      await tx.guildConfig.deleteMany({ where: { guildId } });
      await tx.guild.deleteMany({ where: { guildId } });
    });

    logger.info(`Guild and config deleted: ${guildId}`);
    return c.json({ success: true });
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "delete_guild" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/guilds/:id/config
router.get("/:id/config", async (c) => {
  const guildId = c.req.param("id");
  const logger = c.get("logger");

  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Guild configuration not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "fetch_guild_config" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/guilds/:id/config
router.patch("/:id/config", zValidator("json", GuildConfigSchema.strict().partial()), async (c) => {
  const guildId = c.req.param("id");
  const data = c.req.valid("json");
  const logger = c.get("logger");

  try {
    // Ensure Guild exists first
    await prisma.guild.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });

    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      update: data,
      create: {
        ...data,
        guildId,
      },
    });

    return c.json(config);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "config_update_failed", guild_id: guildId, operation: "update_guild_config" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
