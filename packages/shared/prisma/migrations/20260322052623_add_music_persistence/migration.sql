-- CreateTable
CREATE TABLE "MusicQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "currentSongId" TEXT,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "volume" INTEGER NOT NULL DEFAULT 100,
    "loopMode" TEXT NOT NULL DEFAULT 'none',
    "lastSeek" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MusicQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "thumbnail" TEXT,
    "position" INTEGER NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MusicQueueItem_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "MusicQueue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildMusicConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "defaultVolume" INTEGER NOT NULL DEFAULT 100,
    "autoCleanup" BOOLEAN NOT NULL DEFAULT true,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicQueue_guildId_key" ON "MusicQueue"("guildId");

-- CreateIndex
CREATE INDEX "MusicQueueItem_queueId_idx" ON "MusicQueueItem"("queueId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMusicConfig_guildId_key" ON "GuildMusicConfig"("guildId");
