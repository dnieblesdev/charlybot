import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { VerificationRequestSchema } from "@charlybot/shared";
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

const VerificationReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// GET /api/v1/verifications/pending/:guildId?page=1&limit=20
router.get("/pending/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  const { page, limit } = PaginationSchema.parse(c.req.query());

  try {
    const [data, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where: { guildId, status: "pending" },
        orderBy: { requestedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.verificationRequest.count({ where: { guildId, status: "pending" } }),
    ]);

    return c.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error fetching pending verifications for guild ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/verifications/:id — approve/reject
router.patch("/:id", zValidator("json", VerificationReviewSchema), async (c) => {
  const id = c.req.param("id");
  const { status } = c.req.valid("json");
  const reviewedAt = new Date();

  try {
    const verification = await prisma.verificationRequest.update({
      where: { id },
      data: {
        status,
        reviewedAt,
      },
    });

    return c.json(verification);
  } catch (error) {
    logger.error(`Error updating verification ${id}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
