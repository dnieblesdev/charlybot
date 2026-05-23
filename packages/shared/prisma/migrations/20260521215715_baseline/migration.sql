-- CreateTable
CREATE TABLE "tipoClase" (
    "rolId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tipoClase_pkey" PRIMARY KEY ("guildId","rolId")
);

-- CreateTable
CREATE TABLE "classes" (
    "rolId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("guildId","rolId")
);

-- CreateTable
CREATE TABLE "subclass" (
    "rolId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subclass_pkey" PRIMARY KEY ("guildId","rolId")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT,
    "prefix" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT,
    "MemberCount" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEconomy" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pocket" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inJail" BOOLEAN NOT NULL DEFAULT false,
    "jailReleaseAt" TIMESTAMPTZ(3),
    "lastWork" TIMESTAMPTZ(3),
    "lastCrime" TIMESTAMPTZ(3),
    "lastRob" TIMESTAMPTZ(3),
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserEconomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalBank" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "bank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GlobalBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouletteGame" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "winningNumber" INTEGER,
    "winningColor" TEXT,
    "startTime" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spinTime" TIMESTAMPTZ(3),
    "endTime" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RouletteGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouletteBet" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "betType" TEXT NOT NULL,
    "betValue" TEXT NOT NULL,
    "result" TEXT,
    "winAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RouletteBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyConfig" (
    "id" SERIAL NOT NULL,
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
    "rouletteChannelId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EconomyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalMoney" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "joinedServerAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoRole" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "embedTitle" TEXT,
    "embedDesc" TEXT,
    "embedColor" TEXT,
    "embedFooter" TEXT,
    "embedThumb" TEXT,
    "embedImage" TEXT,
    "embedTimestamp" BOOLEAN,
    "embedAuthor" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AutoRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleMapping" (
    "id" SERIAL NOT NULL,
    "autoRoleId" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "emoji" TEXT,
    "buttonLabel" TEXT,
    "buttonStyle" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inGameName" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicQueue" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "currentSongId" TEXT,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "volume" INTEGER NOT NULL DEFAULT 100,
    "loopMode" TEXT NOT NULL DEFAULT 'none',
    "lastSeek" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicQueueItem" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "thumbnail" TEXT,
    "position" INTEGER NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MusicQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMusicConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "defaultVolume" INTEGER NOT NULL DEFAULT 100,
    "autoCleanup" BOOLEAN NOT NULL DEFAULT true,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMusicConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserXP" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserXP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "xpPerMessage" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "levelUpChannelId" TEXT,
    "levelUpMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "XPConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelRole" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "LevelRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLink" (
    "guildId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("guildId","platform")
);

-- CreateTable
CREATE TABLE "WelcomeCustomVar" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WelcomeCustomVar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModCase" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "duration" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "messageCount" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarnThreshold" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "warnCount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "duration" BIGINT,

    CONSTRAINT "WarnThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiSpamConfig" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "burstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "duplicateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mentionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "linkEnabled" BOOLEAN NOT NULL DEFAULT true,
    "capsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emojiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "comboEnabled" BOOLEAN NOT NULL DEFAULT false,
    "burstAction" TEXT NOT NULL DEFAULT 'warn',
    "duplicateAction" TEXT NOT NULL DEFAULT 'warn',
    "mentionAction" TEXT NOT NULL DEFAULT 'timeout_5min',
    "linkAction" TEXT NOT NULL DEFAULT 'timeout_5min',
    "capsAction" TEXT NOT NULL DEFAULT 'warn',
    "emojiAction" TEXT NOT NULL DEFAULT 'warn',
    "comboAction" TEXT NOT NULL DEFAULT 'timeout_5min',
    "escalationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "escalationCount" INTEGER NOT NULL DEFAULT 3,
    "notifyOnSpam" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AntiSpamConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntiSpamHistory" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AntiSpamHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_guildId_key" ON "Guild"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEconomy_userId_guildId_key" ON "UserEconomy"("userId", "guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalBank_userId_key" ON "GlobalBank"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EconomyConfig_guildId_key" ON "EconomyConfig"("guildId");

-- CreateIndex
CREATE INDEX "Leaderboard_guildId_totalMoney_joinedServerAt_idx" ON "Leaderboard"("guildId", "totalMoney", "joinedServerAt");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_userId_guildId_key" ON "Leaderboard"("userId", "guildId");

-- CreateIndex
CREATE INDEX "AutoRole_guildId_idx" ON "AutoRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoRole_guildId_messageId_key" ON "AutoRole"("guildId", "messageId");

-- CreateIndex
CREATE INDEX "RoleMapping_autoRoleId_idx" ON "RoleMapping"("autoRoleId");

-- CreateIndex
CREATE INDEX "VerificationRequest_guildId_status_idx" ON "VerificationRequest"("guildId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MusicQueue_guildId_key" ON "MusicQueue"("guildId");

-- CreateIndex
CREATE INDEX "MusicQueueItem_queueId_idx" ON "MusicQueueItem"("queueId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMusicConfig_guildId_key" ON "GuildMusicConfig"("guildId");

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
CREATE INDEX "WelcomeCustomVar_guildId_idx" ON "WelcomeCustomVar"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "WelcomeCustomVar_guildId_name_key" ON "WelcomeCustomVar"("guildId", "name");

-- CreateIndex
CREATE INDEX "ModCase_guildId_userId_idx" ON "ModCase"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModCase_guildId_caseNumber_key" ON "ModCase"("guildId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarnThreshold_guildId_warnCount_key" ON "WarnThreshold"("guildId", "warnCount");

-- CreateIndex
CREATE UNIQUE INDEX "AntiSpamConfig_guildId_key" ON "AntiSpamConfig"("guildId");

-- CreateIndex
CREATE INDEX "AntiSpamHistory_guildId_userId_createdAt_idx" ON "AntiSpamHistory"("guildId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AntiSpamHistory_guildId_userId_idx" ON "AntiSpamHistory"("guildId", "userId");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_guildId_tipoId_fkey" FOREIGN KEY ("guildId", "tipoId") REFERENCES "tipoClase"("guildId", "rolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subclass" ADD CONSTRAINT "subclass_guildId_claseId_fkey" FOREIGN KEY ("guildId", "claseId") REFERENCES "classes"("guildId", "rolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildConfig" ADD CONSTRAINT "GuildConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouletteBet" ADD CONSTRAINT "RouletteBet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "RouletteGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouletteBet" ADD CONSTRAINT "RouletteBet_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "UserEconomy"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMapping" ADD CONSTRAINT "RoleMapping_autoRoleId_fkey" FOREIGN KEY ("autoRoleId") REFERENCES "AutoRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicQueueItem" ADD CONSTRAINT "MusicQueueItem_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "MusicQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialLink" ADD CONSTRAINT "SocialLink_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntiSpamConfig" ADD CONSTRAINT "AntiSpamConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
