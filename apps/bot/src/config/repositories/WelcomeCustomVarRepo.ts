import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";

/**
 * Gets a single custom variable for a guild.
 * Returns null if not found.
 */
export async function getWelcomeCustomVar(
  guildId: string,
  name: string,
): Promise<string | null> {
  const variable = await prisma.welcomeCustomVar.findUnique({
    where: { guildId_name: { guildId, name } },
    select: { value: true },
  });

  return variable?.value ?? null;
}

/**
 * Sets or updates a custom welcome variable for a guild.
 */
export async function setWelcomeCustomVar(
  guildId: string,
  name: string,
  value: string,
): Promise<void> {
  // Ensure Guild exists first
  await prisma.guild.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.welcomeCustomVar.upsert({
    where: { guildId_name: { guildId, name } },
    update: { value },
    create: { guildId, name, value },
  });

  logger.info(`✅ Welcome custom var set: [${guildId}] ${name} → ${value}`);
}

/**
 * Lists all custom welcome variables for a guild.
 * Returns a Map of name → value.
 */
export async function listWelcomeCustomVars(
  guildId: string,
): Promise<Map<string, string>> {
  const vars = await prisma.welcomeCustomVar.findMany({
    where: { guildId },
    select: { name: true, value: true },
  });

  const map = new Map<string, string>();
  for (const v of vars) {
    map.set(v.name, v.value);
  }
  return map;
}

/**
 * Removes a custom welcome variable for a guild.
 */
export async function removeWelcomeCustomVar(
  guildId: string,
  name: string,
): Promise<void> {
  await prisma.welcomeCustomVar.delete({
    where: { guildId_name: { guildId, name } },
  });

  logger.info(`🗑️ Welcome custom var removed: [${guildId}] ${name}`);
}