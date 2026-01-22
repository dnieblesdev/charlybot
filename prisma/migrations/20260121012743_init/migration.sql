-- CreateTable
CREATE TABLE "Guild" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "name" TEXT,
    "prefix" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "MemberCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
CREATE UNIQUE INDEX "Guild_guildId_key" ON "Guild"("guildId");
