import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { AutoRoleSchema, RoleMappingSchema } from "@charlybot/shared";
import { z } from "zod";
import { logRouteError } from "../utils/logRouteError";
import { authMiddleware } from "../middleware/authMiddleware";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";
import { jwtAuth } from "../middleware/jwtMiddleware";

const router = new Hono();

// Apply auth + guild access middleware to all routes
router.use("/*", authMiddleware);
router.use("/*", guildAccessMiddleware);

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateAutoRoleSchema = AutoRoleSchema.extend({
  mappings: z.array(RoleMappingSchema),
}).omit({ createdBy: true });

const UpdateAutoRoleSchema = AutoRoleSchema.partial();
const CreateMappingSchema = RoleMappingSchema;
const UpdateMappingSchema = RoleMappingSchema.partial();

// GET /api/v1/autoroles/guild/:guildId?page=1&limit=20
router.get("/guild/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const { page, limit } = PaginationSchema.parse(c.req.query());
  const logger = c.get("logger");

  try {
    const [data, total] = await Promise.all([
      prisma.autoRole.findMany({
        where: { guildId },
        include: { mappings: { orderBy: { order: "asc" } } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.autoRole.count({ where: { guildId } }),
    ]);

    return c.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", guild_id: guildId, operation: "fetch_autoroles" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/autoroles — create autorole with optional mappings
router.post("/", jwtAuth, zValidator("json", CreateAutoRoleSchema), async (c) => {
  const data = c.req.valid("json");
  const jwt = c.get("jwt");
  const createdBy = jwt?.userId ?? "unknown";
  const logger = c.get("logger");

  try {
    const autorole = await prisma.autoRole.create({
      data: {
        guildId: data.guildId,
        channelId: data.channelId,
        messageId: data.messageId,
        mode: data.mode,
        embedTitle: data.embedTitle ?? null,
        embedDesc: data.embedDesc ?? null,
        embedColor: data.embedColor ?? null,
        embedFooter: data.embedFooter ?? null,
        embedThumb: data.embedThumb ?? null,
        embedImage: data.embedImage ?? null,
        embedTimestamp: data.embedTimestamp ?? null,
        embedAuthor: data.embedAuthor ?? null,
        createdBy,
        mappings: data.mappings
          ? {
              create: data.mappings.map((m) => ({
                roleId: m.roleId,
                type: m.type,
                emoji: m.emoji ?? null,
                buttonLabel: m.buttonLabel ?? null,
                buttonStyle: m.buttonStyle ?? null,
                order: m.order,
              })),
            }
          : undefined,
      },
      include: { mappings: true },
    });

    return c.json(autorole, 201);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", operation: "create_autorole" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/autoroles/:id — update autorole
router.patch("/:id", zValidator("json", UpdateAutoRoleSchema), async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const data = c.req.valid("json");
  const logger = c.get("logger");

  if (isNaN(id)) {
    return c.json({ error: "Invalid autorole ID" }, 400);
  }

  try {
    const autorole = await prisma.autoRole.update({
      where: { id },
      data: {
        channelId: data.channelId,
        messageId: data.messageId,
        mode: data.mode,
        embedTitle: data.embedTitle ?? undefined,
        embedDesc: data.embedDesc ?? undefined,
        embedColor: data.embedColor ?? undefined,
        embedFooter: data.embedFooter ?? undefined,
        embedThumb: data.embedThumb ?? undefined,
        embedImage: data.embedImage ?? undefined,
        embedTimestamp: data.embedTimestamp ?? undefined,
        embedAuthor: data.embedAuthor ?? undefined,
      },
      include: { mappings: { orderBy: { order: "asc" } } },
    });

    return c.json(autorole);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", operation: "update_autorole" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/autoroles/:id — delete autorole
router.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const logger = c.get("logger");

  if (isNaN(id)) {
    return c.json({ error: "Invalid autorole ID" }, 400);
  }

  try {
    await prisma.autoRole.delete({
      where: { id },
    });

    return c.json({ success: true });
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", operation: "delete_autorole" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/autoroles/:id/mappings — add mapping
router.post("/:id/mappings", zValidator("json", CreateMappingSchema), async (c) => {
  const autoRoleId = parseInt(c.req.param("id"), 10);
  const data = c.req.valid("json");
  const logger = c.get("logger");

  if (isNaN(autoRoleId)) {
    return c.json({ error: "Invalid autorole ID" }, 400);
  }

  try {
    const mapping = await prisma.roleMapping.create({
      data: {
        autoRoleId,
        roleId: data.roleId,
        type: data.type,
        emoji: data.emoji ?? null,
        buttonLabel: data.buttonLabel ?? null,
        buttonStyle: data.buttonStyle ?? null,
        order: data.order,
      },
    });

    return c.json(mapping, 201);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", operation: "create_role_mapping" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/autoroles/mappings/:mappingId — update mapping
router.patch("/mappings/:mappingId", zValidator("json", UpdateMappingSchema), async (c) => {
  const mappingId = parseInt(c.req.param("mappingId"), 10);
  const data = c.req.valid("json");
  const logger = c.get("logger");

  if (isNaN(mappingId)) {
    return c.json({ error: "Invalid mapping ID" }, 400);
  }

  try {
    const mapping = await prisma.roleMapping.update({
      where: { id: mappingId },
      data: {
        roleId: data.roleId ?? undefined,
        type: data.type ?? undefined,
        emoji: data.emoji ?? undefined,
        buttonLabel: data.buttonLabel ?? undefined,
        buttonStyle: data.buttonStyle ?? undefined,
        order: data.order ?? undefined,
      },
    });

    return c.json(mapping);
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", operation: "update_role_mapping" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/autoroles/mappings/:mappingId — remove mapping
router.delete("/mappings/:mappingId", async (c) => {
  const mappingId = parseInt(c.req.param("mappingId"), 10);
  const logger = c.get("logger");

  if (isNaN(mappingId)) {
    return c.json({ error: "Invalid mapping ID" }, 400);
  }

  try {
    await prisma.roleMapping.delete({
      where: { id: mappingId },
    });

    return c.json({ success: true });
  } catch (error) {
    logRouteError(logger, {
      c,
      error,
      meta: { type: "db_query_failed", operation: "delete_role_mapping" },
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
