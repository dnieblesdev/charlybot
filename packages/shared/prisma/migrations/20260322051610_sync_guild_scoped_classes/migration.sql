/*
  Warnings:

  - The primary key for the `classes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `subclass` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `tipoClase` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `guildId` to the `classes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `subclass` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `tipoClase` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inGameName" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_classes" (
    "rolId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("guildId", "rolId"),
    CONSTRAINT "classes_guildId_tipoId_fkey" FOREIGN KEY ("guildId", "tipoId") REFERENCES "tipoClase" ("guildId", "rolId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_classes" ("created_at", "name", "rolId", "tipoId", "updated_at") SELECT "created_at", "name", "rolId", "tipoId", "updated_at" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE TABLE "new_subclass" (
    "rolId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("guildId", "rolId"),
    CONSTRAINT "subclass_guildId_claseId_fkey" FOREIGN KEY ("guildId", "claseId") REFERENCES "classes" ("guildId", "rolId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_subclass" ("claseId", "created_at", "name", "rolId", "updated_at") SELECT "claseId", "created_at", "name", "rolId", "updated_at" FROM "subclass";
DROP TABLE "subclass";
ALTER TABLE "new_subclass" RENAME TO "subclass";
CREATE TABLE "new_tipoClase" (
    "rolId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,

    PRIMARY KEY ("guildId", "rolId")
);
INSERT INTO "new_tipoClase" ("created_at", "nombre", "rolId", "updated_at") SELECT "created_at", "nombre", "rolId", "updated_at" FROM "tipoClase";
DROP TABLE "tipoClase";
ALTER TABLE "new_tipoClase" RENAME TO "tipoClase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "VerificationRequest_guildId_status_idx" ON "VerificationRequest"("guildId", "status");
