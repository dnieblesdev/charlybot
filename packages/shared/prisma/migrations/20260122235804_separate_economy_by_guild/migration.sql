/*
  Warnings:

  - You are about to drop the column `bank` on the `UserEconomy` table. All the data in the column will be lost.
  - Added the required column `guildId` to the `RouletteBet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `UserEconomy` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "GlobalBank" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "bank" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RouletteBet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "betType" TEXT NOT NULL,
    "betValue" TEXT NOT NULL,
    "result" TEXT,
    "winAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RouletteBet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "RouletteGame" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouletteBet_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "UserEconomy" ("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RouletteBet" ("amount", "betType", "betValue", "createdAt", "gameId", "id", "result", "updatedAt", "userId", "winAmount") SELECT "amount", "betType", "betValue", "createdAt", "gameId", "id", "result", "updatedAt", "userId", "winAmount" FROM "RouletteBet";
DROP TABLE "RouletteBet";
ALTER TABLE "new_RouletteBet" RENAME TO "RouletteBet";
CREATE TABLE "new_UserEconomy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pocket" REAL NOT NULL DEFAULT 0,
    "inJail" BOOLEAN NOT NULL DEFAULT false,
    "jailReleaseAt" DATETIME,
    "lastWork" DATETIME,
    "lastCrime" DATETIME,
    "lastRob" DATETIME,
    "totalEarned" REAL NOT NULL DEFAULT 0,
    "totalLost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserEconomy" ("createdAt", "id", "inJail", "jailReleaseAt", "lastCrime", "lastRob", "lastWork", "pocket", "totalEarned", "totalLost", "updatedAt", "userId", "username") SELECT "createdAt", "id", "inJail", "jailReleaseAt", "lastCrime", "lastRob", "lastWork", "pocket", "totalEarned", "totalLost", "updatedAt", "userId", "username" FROM "UserEconomy";
DROP TABLE "UserEconomy";
ALTER TABLE "new_UserEconomy" RENAME TO "UserEconomy";
CREATE UNIQUE INDEX "UserEconomy_userId_guildId_key" ON "UserEconomy"("userId", "guildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GlobalBank_userId_key" ON "GlobalBank"("userId");
