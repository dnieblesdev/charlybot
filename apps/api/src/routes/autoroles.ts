import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { AutoRoleSchema, RoleMappingSchema } from "@charlybot/shared";
import logger from "../utils/logger";

const router = new Hono();

// GET /api/v1/autoroles/guild/:guildId
router.get("/guild/:guildId", async (c) => {
  const { guildId } = c.req.param();

  try {
    const autoroles = await prisma.autoRole.findMany({
      where: { guildId },
      include: { mappings: true },
    });

    return c.json(autoroles);
  } catch (error) {
    logger.error(`Error fetching autoroles for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/autoroles/message/:guildId/:messageId
router.get("/message/:guildId/:messageId", async (c) => {
  const { guildId, messageId } = c.req.param();

  try {
    const autorole = await prisma.autoRole.findUnique({
      where: { guildId_messageId: { guildId, messageId } },
      include: { mappings: true },
    });

    if (!autorole) {
      return c.json({ error: "AutoRole not found for messageId" }, 404);
    }

    return c.json(autorole);
  } catch (error) {
    logger.error(`Error fetching autorole for messageId ${messageId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/autoroles
router.post("/", zValidator("json", AutoRoleSchema), async (c) => {
  const data = c.req.valid("json");
  const { mappings, ...rest } = data;

  try {
    const autorole = await prisma.autoRole.create({
      data: {
        ...rest,
        mappings: {
          create: mappings,
        },
      },
      include: { mappings: true },
    });

    return c.json(autorole, 201);
  } catch (error) {
    logger.error(`Error creating autorole`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/autoroles/:id
router.patch("/:id", zValidator("json", AutoRoleSchema.partial().omit({ mappings: true })), async (c) => {
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");

  try {
    const autorole = await prisma.autoRole.update({
      where: { id },
      data,
      include: { mappings: true },
    });

    return c.json(autorole);
  } catch (error) {
    logger.error(`Error updating autorole ${id}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/autoroles/:id
router.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));

  try {
    await prisma.autoRole.delete({
      where: { id },
    });

    return c.json({ message: "AutoRole deleted" });
  } catch (error) {
    logger.error(`Error deleting autorole ${id}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// --- Role Mappings ---

// POST /api/v1/autoroles/:id/mappings
router.post("/:id/mappings", zValidator("json", RoleMappingSchema), async (c) => {
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");

  try {
    const mapping = await prisma.roleMapping.create({
      data: {
        ...data,
        autoRoleId: id,
      },
    });

    return c.json(mapping, 201);
  } catch (error) {
    logger.error(`Error adding mapping to autorole ${id}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/autoroles/mappings/:mappingId
router.patch("/mappings/:mappingId", zValidator("json", RoleMappingSchema.partial()), async (c) => {
  const mappingId = Number(c.req.param("mappingId"));
  const data = c.req.valid("json");

  try {
    const mapping = await prisma.roleMapping.update({
      where: { id: mappingId },
      data,
    });

    return c.json(mapping);
  } catch (error) {
    logger.error(`Error updating mapping ${mappingId}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/autoroles/mappings/:mappingId
router.delete("/mappings/:mappingId", async (c) => {
  const mappingId = Number(c.req.param("mappingId"));

  try {
    await prisma.roleMapping.delete({
      where: { id: mappingId },
    });

    return c.json({ message: "Mapping deleted" });
  } catch (error) {
    logger.error(`Error deleting mapping ${mappingId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
