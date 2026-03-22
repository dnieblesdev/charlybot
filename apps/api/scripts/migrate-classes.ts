import { prisma } from "@charlybot/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function migrate() {
  const guildId = process.env.GUILD_ID || "1456942974910398642"; // Default from known test guild or user provided
  const jsonPath = join(process.cwd(), "..", "bot", "data", "class-roles.json");
  
  console.log(`🚀 Starting migration for guild: ${guildId}`);
  console.log(`📂 Reading from: ${jsonPath}`);

  try {
    const rawData = readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(rawData);
    const classes = data.classes;

    for (const className in classes) {
      const cls = classes[className];
      console.log(`📦 Processing class: ${cls.name} (${cls.type})`);

      // 1. Upsert TipoClase
      await prisma.tipoClase.upsert({
        where: { guildId_rolId: { guildId, rolId: cls.typeRoleId } },
        update: { nombre: cls.type },
        create: { guildId, rolId: cls.typeRoleId, nombre: cls.type },
      });

      // 2. Upsert Class
      await prisma.classes.upsert({
        where: { guildId_rolId: { guildId, rolId: cls.roleId } },
        update: { name: cls.name, tipoId: cls.typeRoleId },
        create: { guildId, rolId: cls.roleId, name: cls.name, tipoId: cls.typeRoleId },
      });

      // 3. Clear existing subclasses for this class (to avoid duplicates)
      await prisma.subclass.deleteMany({
        where: { guildId, claseId: cls.roleId },
      });

      // 4. Create Subclasses
      if (cls.subclasses && cls.subclasses.length > 0) {
        await prisma.subclass.createMany({
          data: cls.subclasses.map((sub: any) => ({
            guildId,
            claseId: cls.roleId,
            name: sub.name,
            rolId: sub.roleId,
          })),
        });
        console.log(`   ✅ Added ${cls.subclasses.length} subclasses`);
      }
    }

    console.log("✨ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
