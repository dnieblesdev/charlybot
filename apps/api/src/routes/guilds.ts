import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { GuildConfigSchema } from "@charlybot/shared";
import logger from "../utils/logger";

const router = new Hono();

// GET /api/v1/guilds/:id/config
router.get("/:id/config", async (c) => {
  const guildId = c.req.param("id");

  try {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      return c.json({ error: "Guild configuration not found" }, 404);
    }

    return c.json(config);
  } catch (error) {
    logger.error(`Error fetching guild config for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/guilds/:id/config
router.patch("/:id/config", zValidator("json", GuildConfigSchema.partial()), async (c) => {
  const guildId = c.req.param("id");
  const data = c.req.valid("json");

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
    logger.error(`Error updating guild config for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
