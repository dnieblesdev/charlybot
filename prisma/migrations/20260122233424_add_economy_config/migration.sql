-- CreateTable
CREATE TABLE "EconomyConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "workCooldown" INTEGER NOT NULL DEFAULT 300000,
    "crimeCooldown" INTEGER NOT NULL DEFAULT 900000,
    "robCooldown" INTEGER NOT NULL DEFAULT 1800000,
    "workMinAmount" INTEGER NOT NULL DEFAULT 100,
    "workMaxAmount" INTEGER NOT NULL DEFAULT 300,
    "crimeMultiplier" INTEGER NOT NULL DEFAULT 3,
    "startingMoney" INTEGER NOT NULL DEFAULT 1000,
    "jailTimeWork" INTEGER NOT NULL DEFAULT 30,
    "jailTimeRob" INTEGER NOT NULL DEFAULT 45,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EconomyConfig_guildId_key" ON "EconomyConfig"("guildId");
