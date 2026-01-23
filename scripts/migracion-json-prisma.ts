import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "../src/infrastructure/storage/prismaClient.js";

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

interface OldVerificationsData {
  requests: Record<
    string,
    {
      id: string;
      userId: string;
      guildId: string;
      inGameName: string;
      screenshotUrl: string;
      status: "pending" | "approved" | "rejected";
      requestedAt: number;
      messageId?: string;
      reviewedBy?: string;
      reviewedAt?: number;
    }
  >;
}

async function migrateGuildsAndConfigs() {
  console.log("\n📋 Migrando Guilds y configuraciones...");

  try {
    const configPath = path.join(process.cwd(), "data", "config.json");
    const data = await readFile(configPath, "utf-8");
    const oldConfig: OldConfigData = JSON.parse(data);

    let migratedCount = 0;
    for (const [guildId, config] of Object.entries(oldConfig.guilds)) {
      // Primero crear o actualizar el Guild
      await prisma.guild.upsert({
        where: { guildId },
        create: {
          guildId,
          name: null,
          prefix: null,
          ownerId: null,
          ownerName: null,
          MemberCount: null,
        },
        update: {},
      });

      console.log(`  ✅ Guild creado/actualizado: ${guildId}`);

      // Luego crear o actualizar el GuildConfig
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
      console.log(`  ✅ Guild config migrada: ${guildId}`);
    }

    console.log(`✨ Total guilds y configs migradas: ${migratedCount}`);
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
      // Crear tipo de clase si no existe
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

      // Crear clase
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

      // Crear subclases
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

async function migrateVerifications() {
  console.log("\n✅ Migrando verificaciones...");

  try {
    const verificationsPath = path.join(
      process.cwd(),
      "data",
      "verifications.json",
    );
    const data = await readFile(verificationsPath, "utf-8");
    const oldVerifications: OldVerificationsData = JSON.parse(data);

    // Nota: No hay modelo VerificationRequest en el schema actual
    // Si necesitas migrar esto, necesitarás agregar el modelo primero
    console.log(
      "⚠️  ADVERTENCIA: No hay modelo de verificaciones en el schema actual.",
    );
    console.log(
      `   Se encontraron ${Object.keys(oldVerifications.requests).length} verificaciones en el JSON.`,
    );
    console.log(
      "   Si necesitas migrar estos datos, agrega primero el modelo VerificationRequest al schema.",
    );

    // Descomenta esto cuando agregues el modelo al schema:
    /*
    let migratedCount = 0;
    for (const [requestId, request] of Object.entries(oldVerifications.requests)) {
      await prisma.verificationRequest.upsert({
        where: { id: requestId },
        create: {
          id: request.id,
          userId: request.userId,
          guildId: request.guildId,
          inGameName: request.inGameName,
          screenshotUrl: request.screenshotUrl,
          status: request.status,
          requestedAt: new Date(request.requestedAt),
          messageId: request.messageId || null,
          reviewedBy: request.reviewedBy || null,
          reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
        },
        update: {
          userId: request.userId,
          guildId: request.guildId,
          inGameName: request.inGameName,
          screenshotUrl: request.screenshotUrl,
          status: request.status,
          requestedAt: new Date(request.requestedAt),
          messageId: request.messageId || null,
          reviewedBy: request.reviewedBy || null,
          reviewedAt: request.reviewedAt ? new Date(request.reviewedAt) : null,
        },
      });

      migratedCount++;
      console.log(`  ✅ Verificación migrada: ${request.inGameName} (${request.status})`);
    }

    console.log(`✨ Total verificaciones migradas: ${migratedCount}`);
    */
  } catch (error) {
    console.error("❌ Error migrando verificaciones:", error);
    // No lanzamos el error para que continúe la migración
  }
}

async function main() {
  console.log("🚀 Iniciando migración de datos JSON a Prisma...\n");

  try {
    // Migrar en orden correcto (Guild antes de GuildConfig)
    await migrateGuildsAndConfigs();
    await migrateClassRoles();
    await migrateVerifications();

    console.log("\n🎉 ¡Migración completada exitosamente!");
    console.log("\n📊 Resumen final:");

    const guildCount = await prisma.guild.count();
    const guildConfigCount = await prisma.guildConfig.count();
    const tipoClaseCount = await prisma.tipoClase.count();
    const classCount = await prisma.classes.count();
    const subclassCount = await prisma.subclass.count();

    console.log(`  • Guilds: ${guildCount}`);
    console.log(`  • Guild Configs: ${guildConfigCount}`);
    console.log(`  • Tipos de Clase: ${tipoClaseCount}`);
    console.log(`  • Clases: ${classCount}`);
    console.log(`  • Subclases: ${subclassCount}`);

    console.log("\n💡 Nota sobre verificaciones:");
    console.log(
      "   Las verificaciones NO fueron migradas porque no existe el modelo en el schema.",
    );
    console.log(
      "   Si necesitas migrarlas, agrega el modelo VerificationRequest y vuelve a ejecutar el script.",
    );
  } catch (error) {
    console.error("\n💥 Error durante la migración:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
