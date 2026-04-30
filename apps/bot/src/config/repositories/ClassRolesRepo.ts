import { prisma } from "@charlybot/shared";
import logger from "../../utils/logger";
import type { IClassConfig } from "@charlybot/shared";

export async function addClass(guildId: string, classConfig: IClassConfig): Promise<void> {
  const { name, roleId, type, typeRoleId, subclasses } = classConfig;

  await prisma.$transaction(async (tx) => {
    // 1. Upsert tipoClase
    await tx.tipoClase.upsert({
      where: { guildId_rolId: { guildId, rolId: typeRoleId } },
      update: { nombre: type },
      create: { guildId, rolId: typeRoleId, nombre: type },
    });

    // 2. Upsert classes
    await tx.classes.upsert({
      where: { guildId_rolId: { guildId, rolId: roleId } },
      update: { name, tipoId: typeRoleId },
      create: { guildId, rolId: roleId, name, tipoId: typeRoleId },
    });

    // 3. Handle subclasses (delete and recreate)
    await tx.subclass.deleteMany({
      where: { guildId, claseId: roleId },
    });

    if (subclasses.length > 0) {
      await tx.subclass.createMany({
        data: subclasses.map((sub) => ({
          guildId,
          claseId: roleId,
          name: sub.name,
          rolId: sub.roleId,
        })),
      });
    }
  });

  logger.info(`✅ Clase añadida: ${name} en ${guildId}`);
}

export async function getClass(guildId: string, name: string): Promise<IClassConfig | null> {
  const cls = await prisma.classes.findFirst({
    where: { guildId, name },
    include: {
      tipo: true,
      subClases: true,
    },
  });

  if (!cls) return null;

  return {
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
}

export async function getAllClasses(guildId: string): Promise<IClassConfig[]> {
  const classes = await prisma.classes.findMany({
    where: { guildId },
    include: {
      tipo: true,
      subClases: true,
    },
  });

  return classes.map((cls) => ({
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
}

export async function removeClass(guildId: string, name: string): Promise<void> {
  const cls = await prisma.classes.findFirst({
    where: { guildId, name },
  });

  if (!cls) {
    logger.warn(`🗑️ Clase no encontrada: ${name} en ${guildId}`);
    return;
  }

  await prisma.classes.delete({
    where: { guildId_rolId: { guildId, rolId: cls.rolId } },
  });

  logger.info(`🗑️ Clase eliminada: ${name} en ${guildId}`);
}

export async function classExists(guildId: string, name: string): Promise<boolean> {
  const cls = await prisma.classes.findFirst({
    where: { guildId, name },
  });
  return cls !== null;
}
