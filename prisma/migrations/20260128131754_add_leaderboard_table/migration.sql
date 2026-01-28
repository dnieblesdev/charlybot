-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "totalMoney" REAL NOT NULL DEFAULT 0,
    "joinedServerAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Leaderboard_guildId_totalMoney_joinedServerAt_idx" ON "Leaderboard"("guildId", "totalMoney", "joinedServerAt");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_userId_guildId_key" ON "Leaderboard"("userId", "guildId");
