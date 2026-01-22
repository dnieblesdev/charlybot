import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "../src/infrastructure/storage/prismaClient.ts";

interface OldConfigData {
  guilds: Record<
    string,
    {
      guildId: string;
      targetChannelId?: string;
      voiceLogChannelId?: string;
      welcomeChannelId?: string;
      welcomeMessage?: string;
      leaveLogChannelId?: string;
      verificationChannelId?: string;
      verificationReviewChannelId?: string;
      verifiedRoleId?: string;
    }
  >;
}

interface OldClassRolesData {
  classes: Record<
    string,
    {
      name: string;
      roleId: string;
      type: "Tank" | "DPS" | "Healer";
      typeRoleId: string;
      subclasses: Array<{
        name: string;
        roleId: string;
      }>;
    }
  >;
}

async function migrateGuildConfigs() {
  console.log("\n📋 Migrando configuraciones de guilds...");

  try {
    const configPath = path.join(process.cwd(), "data", "config.json");
    const data = await readFile(configPath, "utf-8");
    const oldConfig: OldConfigData = JSON.parse(data);

    let migratedCount = 0;
    for (const [guildId, config] of Object.entries(oldConfig.guilds)) {
      await prisma.guildConfig.upsert({
        where: { guildId },
        create: {
          guildId,
          targetChannelId: config.targetChannelId || null,
          voiceLogChannelId: config.voiceLogChannelId || null,
          welcomeChannelId: config.welcomeChannelId || null,
          welcomeMessage: config.welcomeMessage || null,
          leaveLogChannelId: config.leaveLogChannelId || null,
          verificationChannelId: config.verificationChannelId || null,
          verificationReviewChannelId:
            config.verificationReviewChannelId || null,
          verifiedRoleId: config.verifiedRoleId || null,
        },
        update: {
          targetChannelId: config.targetChannelId || null,
          voiceLogChannelId: config.voiceLogChannelId || null,
          welcomeChannelId: config.welcomeChannelId || null,
          welcomeMessage: config.welcomeMessage || null,
          leaveLogChannelId: config.leaveLogChannelId || null,
          verificationChannelId: config.verificationChannelId || null,
          verificationReviewChannelId:
            config.verificationReviewChannelId || null,
          verifiedRoleId: config.verifiedRoleId || null,
        },
      });

      migratedCount++;
      console.log(`  ✅ Guild migrada: ${guildId}`);
    }

    console.log(`✨ Total guild configs migradas: ${migratedCount}`);
  } catch (error) {
    console.error("❌ Error migrando guild configs:", error);
    throw error;
  }
}

async function migrateClassRoles() {
  console.log("\n⚔️  Migrando clases y subclases...");

  try {
    const classRolesPath = path.join(process.cwd(), "data", "class-roles.json");
    const data = await readFile(classRolesPath, "utf-8");
    const oldClassRoles: OldClassRolesData = JSON.parse(data);

    let classCount = 0;
    let subclassCount = 0;
    const tiposCreados = new Set<string>();

    for (const [className, classData] of Object.entries(
      oldClassRoles.classes,
    )) {
      if (!tiposCreados.has(classData.typeRoleId)) {
        await prisma.tipoClase.upsert({
          where: { rolId: classData.typeRoleId },
          create: {
            rolId: classData.typeRoleId,
            nombre: classData.type,
          },
          update: {
            nombre: classData.type,
          },
        });
        tiposCreados.add(classData.typeRoleId);
        console.log(`  ✅ Tipo de clase migrado: ${classData.type}`);
      }

      const createdClass = await prisma.classes.upsert({
        where: { rolId: classData.roleId },
        create: {
          rolId: classData.roleId,
          name: classData.name,
          tipoId: classData.typeRoleId,
        },
        update: {
          name: classData.name,
          tipoId: classData.typeRoleId,
        },
      });

      classCount++;
      console.log(`  ✅ Clase migrada: ${className} (${classData.type})`);

      for (const subclass of classData.subclasses) {
        await prisma.subclass.upsert({
          where: { rolId: subclass.roleId },
          create: {
            rolId: subclass.roleId,
            name: subclass.name,
            claseId: createdClass.rolId,
          },
          update: {
            name: subclass.name,
            claseId: createdClass.rolId,
          },
        });

        subclassCount++;
        console.log(`    ↳ Subclase: ${subclass.name}`);
      }
    }

    console.log(`✨ Total tipos de clase migrados: ${tiposCreados.size}`);
    console.log(`✨ Total clases migradas: ${classCount}`);
    console.log(`✨ Total subclases migradas: ${subclassCount}`);
  } catch (error) {
    console.error("❌ Error migrando class roles:", error);
    throw error;
  }
}

async function main() {
  console.log("🚀 Iniciando migración de datos JSON a Prisma...\n");

  try {
    await migrateGuildConfigs();
    await migrateClassRoles();

    console.log("\n🎉 ¡Migración completada exitosamente!");
    console.log("\n📊 Resumen final:");

    const guildCount = await prisma.guildConfig.count();
    const tipoClaseCount = await prisma.tipoClase.count();
    const classCount = await prisma.classes.count();
    const subclassCount = await prisma.subclass.count();

    console.log(`  • Guild Configs: ${guildCount}`);
    console.log(`  • Tipos de Clase: ${tipoClaseCount}`);
    console.log(`  • Clases: ${classCount}`);
    console.log(`  • Subclases: ${subclassCount}`);
  } catch (error) {
    console.error("\n💥 Error durante la migración:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
