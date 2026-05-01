import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { SubclassSchema } from "@charlybot/shared";
import { z } from "zod";
import logger from "../utils/logger";
import { authMiddleware } from "../middleware/authMiddleware";
import { guildAccessMiddleware } from "../middleware/guildAccessMiddleware";

const router = new Hono();

// Apply auth + guild access middleware to all routes
router.use("/*", authMiddleware);
router.use("/*", guildAccessMiddleware);

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateClassSchema = z.object({
  guildId: z.string(),
  rolId: z.string(),
  name: z.string(),
  type: z.enum(["Healer", "DPS", "Tank"]),
  typeRoleId: z.string(),
  subclasses: z.array(SubclassSchema).optional(),
});

// GET /api/v1/classes/guild/:guildId?page=1&limit=20
router.get("/guild/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const { page, limit } = PaginationSchema.parse(c.req.query());

  try {
    const [data, total] = await Promise.all([
      prisma.classes.findMany({
        where: { guildId },
        include: { subClases: true },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.classes.count({ where: { guildId } }),
    ]);

    return c.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error fetching classes for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/classes — create/update class (replacement-based)
router.post("/", zValidator("json", CreateClassSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    const clase = await prisma.classes.upsert({
      where: { guildId_rolId: { guildId: data.guildId, rolId: data.rolId } },
      update: {
        name: data.name,
        tipoId: data.typeRoleId,
      },
      create: {
        guildId: data.guildId,
        rolId: data.rolId,
        name: data.name,
        tipoId: data.typeRoleId,
      },
    });

    // Handle subclasses replacement
    if (data.subclasses) {
      // Delete existing subclasses and recreate
      await prisma.subclass.deleteMany({
        where: { claseId: clase.rolId, guildId: clase.guildId },
      });

      if (data.subclasses.length > 0) {
        await prisma.subclass.createMany({
          data: data.subclasses.map((sc) => ({
            claseId: clase.rolId, // rolId of parent class
            guildId: data.guildId,
            name: sc.name,
            rolId: sc.roleId,
          })),
        });
      }
    }

    // Fetch updated class with subclasses
    const updated = await prisma.classes.findUnique({
      where: { guildId_rolId: { guildId: clase.guildId, rolId: clase.rolId } },
      include: { subClases: true },
    });

    return c.json(updated, 201);
  } catch (error) {
    logger.error("Error creating/updating class", { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/classes/guild/:guildId/:name — delete class by name
router.delete("/guild/:guildId/:name", async (c) => {
  const { guildId, name } = c.req.param();

  try {
    // Find class by guildId and name first
    const clase = await prisma.classes.findFirst({
      where: { guildId, name },
    });

    if (!clase) {
      return c.json({ error: "Class not found" }, 404);
    }

    await prisma.classes.delete({
      where: { guildId_rolId: { guildId: clase.guildId, rolId: clase.rolId } },
    });

    return c.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting class ${name} in guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
