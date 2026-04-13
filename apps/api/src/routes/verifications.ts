import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "@charlybot/shared";
import { VerificationRequestSchema } from "@charlybot/shared";
import logger from "../utils/logger";

const router = new Hono();
// Force status=pending on create - status field is completely ignored from input
const CreateVerificationSchema = VerificationRequestSchema.omit({
  id: true,
  status: true,
});

// GET /api/v1/verifications/:id
router.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const verification = await prisma.verificationRequest.findUnique({
      where: { id },
    });

    if (!verification) {
      return c.json({ error: "Verification not found" }, 404);
    }

    return c.json(verification);
  } catch (error) {
    logger.error(`Error fetching verification ${id}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/v1/verifications/pending/:guildId
router.get("/pending/:guildId", async (c) => {
  const guildId = c.req.param("guildId");
  // Pagination: default 50, max 100
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize")) || 50));
  const skip = (page - 1) * pageSize;

  try {
    const [pendings, total] = await Promise.all([
      prisma.verificationRequest.findMany({
        where: { guildId, status: "pending" },
        skip,
        take: pageSize,
        orderBy: { requestedAt: "desc" },
      }),
      prisma.verificationRequest.count({
        where: { guildId, status: "pending" },
      }),
    ]);

    return c.json({
      data: pendings,
      page,
      pageSize,
      total,
    });
  } catch (error) {
    logger.error(`Error fetching pending verifications for ${guildId}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/v1/verifications
router.post("/", zValidator("json", CreateVerificationSchema), async (c) => {
  const data = c.req.valid("json");

  try {
    // Force status to pending - ignore any status that might have been passed
    const verification = await prisma.verificationRequest.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        status: "pending",  // Always force pending, regardless of input
        requestedAt: data.requestedAt ? new Date(data.requestedAt as string) : undefined,
        reviewedAt: data.reviewedAt ? new Date(data.reviewedAt as string) : undefined,
      } as any,
    });

    return c.json(verification, 201);
  } catch (error) {
    logger.error(`Error creating verification`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/v1/verifications/:id
router.patch("/:id", zValidator("json", VerificationRequestSchema.partial()), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  try {
    const verification = await prisma.verificationRequest.update({
      where: { id },
      data: {
        ...data,
        requestedAt: data.requestedAt ? new Date(data.requestedAt as string) : undefined,
        reviewedAt: data.reviewedAt ? new Date(data.reviewedAt as string) : undefined,
      } as any,
    });

    return c.json(verification);
  } catch (error) {
    logger.error(`Error updating verification ${id}`, { error, data });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/v1/verifications/:id
router.delete("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    await prisma.verificationRequest.delete({
      where: { id },
    });

    return c.json({ message: "Verification deleted" });
  } catch (error) {
    logger.error(`Error deleting verification ${id}`, { error });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
