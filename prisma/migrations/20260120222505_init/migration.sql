-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "targetChannelId" TEXT,
    "voiceLogChannelId" TEXT,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT,
    "leaveLogChannelId" TEXT,
    "verificationChannelId" TEXT,
    "verificationReviewChannelId" TEXT,
    "verifiedRoleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");
