import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { ClassConfigSchema } from "@charlybot/shared";
import { z } from "zod";
import logger from "../utils/logger";

const router = new Hono();
const CreateClassConfigSchema = ClassConfigSchema.extend({
  subclasses: z.array(
    z.object({
      name: z.string(),
      roleId: z.string(),
      guildId: z.string().optional(),
    }),
  ),
});

// GET /api/v1/classes/guild/:guildId
router.get("/guild/:guildId", async (c) => {
  const { guildId } = c.req.param();

  try {
    const classes = await prisma.classes.findMany({
      where: { guildId },
      include: {
        tipo: true,
        subClases: true,
      },
    });

    const config: any[] = classes.map((cls) => ({
      name: cls.name,
      roleId: cls.rolId,
      type: cls.tipo.nombre,
      typeRoleId: cls.tipo.rolId,
      subclasses: cls.subClases.map((sub) => ({
        name: sub.name,
        roleId: sub.rolId,
        guildId: sub.guildId,
      })),
      guildId: cls.guildId,
    }));

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching classes for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/classes/guild/:guildId/:name
router.get("/guild/:guildId/:name", async (c) => {
  const { guildId, name } = c.req.param();

  try {
    const cls = await prisma.classes.findFirst({
      where: { guildId, name },
      include: {
        tipo: true,
        subClases: true,
      },
    });

    if (!cls) {
      return c.json({ error: "Class not found" }, 404);
    }

    const config = {
      name: cls.name,
      roleId: cls.rolId,
      type: cls.tipo.nombre,
      typeRoleId: cls.tipo.rolId,
      subclasses: cls.subClases.map((sub) => ({
        name: sub.name,
        roleId: sub.rolId,
        guildId: sub.guildId,
      })),
      guildId: cls.guildId,
    };

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching class ${name} for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/classes
router.post("/", zValidator("json", CreateClassConfigSchema), async (c) => {
  const data = c.req.valid("json");
  const { name, roleId, type, typeRoleId, subclasses, guildId } = data;

  try {
    // 1. Upsert tipoClase
    await prisma.tipoClase.upsert({
      where: { guildId_rolId: { guildId, rolId: typeRoleId } },
      update: { nombre: type },
      create: { guildId, rolId: typeRoleId, nombre: type },
    });

    // 2. Upsert classes
    await prisma.classes.upsert({
      where: { guildId_rolId: { guildId, rolId: roleId } },
      update: { name, tipoId: typeRoleId },
      create: { guildId, rolId: roleId, name, tipoId: typeRoleId },
    });

    // 3. Handle subclasses (delete and recreate for simplicity in this replacement-based sync)
    await prisma.subclass.deleteMany({
      where: { guildId, claseId: roleId },
    });

    if (subclasses.length > 0) {
      await prisma.subclass.createMany({
        data: subclasses.map((sub) => ({
          guildId,
          claseId: roleId,
          name: sub.name,
          rolId: sub.roleId,
        })),
      });
    }

    return c.json({ message: "Class updated successfully" }, 201);
  } catch (error) {
    logger.error(`Error saving class`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/classes/guild/:guildId/:name
router.delete("/guild/:guildId/:name", async (c) => {
  const { guildId, name } = c.req.param();

  try {
    const cls = await prisma.classes.findFirst({
      where: { guildId, name },
    });

    if (!cls) {
      return c.json({ error: "Class not found" }, 404);
    }

    // Cascading delete should handle subclasses if configured, but let's be safe
    await prisma.classes.delete({
      where: { guildId_rolId: { guildId, rolId: cls.rolId } },
    });

    return c.json({ message: "Class deleted" });
  } catch (error) {
    logger.error(`Error deleting class ${name} for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
