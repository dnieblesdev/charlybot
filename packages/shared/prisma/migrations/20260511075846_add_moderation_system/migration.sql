-- CreateTable
CREATE TABLE "UserXP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XPConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "xpPerMessage" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "levelUpChannelId" TEXT,
    "levelUpMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LevelRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ModCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "duration" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "messageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WarnThreshold" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "warnCount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "duration" BIGINT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuildConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "name" TEXT,
    "targetChannelId" TEXT,
    "voiceLogChannelId" TEXT,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT,
    "leaveLogChannelId" TEXT,
    "verificationChannelId" TEXT,
    "verificationReviewChannelId" TEXT,
    "verifiedRoleId" TEXT,
    "messageLogChannelId" TEXT,
    "modLogChannelId" TEXT,
    "modRoleId" TEXT,
    "antispamEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuildConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GuildConfig" ("createdAt", "guildId", "id", "leaveLogChannelId", "name", "targetChannelId", "updatedAt", "verificationChannelId", "verificationReviewChannelId", "verifiedRoleId", "voiceLogChannelId", "welcomeChannelId", "welcomeMessage") SELECT "createdAt", "guildId", "id", "leaveLogChannelId", "name", "targetChannelId", "updatedAt", "verificationChannelId", "verificationReviewChannelId", "verifiedRoleId", "voiceLogChannelId", "welcomeChannelId", "welcomeMessage" FROM "GuildConfig";
DROP TABLE "GuildConfig";
ALTER TABLE "new_GuildConfig" RENAME TO "GuildConfig";
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserXP_guildId_xp_idx" ON "UserXP"("guildId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "UserXP_userId_guildId_key" ON "UserXP"("userId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "XPConfig_guildId_key" ON "XPConfig"("guildId");

-- CreateIndex
CREATE INDEX "LevelRole_guildId_idx" ON "LevelRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "LevelRole_guildId_level_key" ON "LevelRole"("guildId", "level");

-- CreateIndex
CREATE INDEX "ModCase_guildId_userId_idx" ON "ModCase"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModCase_guildId_caseNumber_key" ON "ModCase"("guildId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarnThreshold_guildId_warnCount_key" ON "WarnThreshold"("guildId", "warnCount");
