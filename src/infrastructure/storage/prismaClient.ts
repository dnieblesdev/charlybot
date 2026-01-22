import { PrismaClient } from "../../generated/prisma/client"; // ← Path al generado
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Crear adapter LibSQL
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

export const prisma =
  globalPrisma.prisma ??
  new PrismaClient({
    adapter, // ← Usar el adapter
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalPrisma.prisma = prisma;
}
