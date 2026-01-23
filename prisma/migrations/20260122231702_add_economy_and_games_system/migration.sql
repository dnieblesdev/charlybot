-- CreateTable
CREATE TABLE "UserEconomy" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pocket" REAL NOT NULL DEFAULT 0,
    "bank" REAL NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "RouletteGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "winningNumber" INTEGER,
    "winningColor" TEXT,
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spinTime" DATETIME,
    "endTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RouletteBet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "betType" TEXT NOT NULL,
    "betValue" TEXT NOT NULL,
    "result" TEXT,
    "winAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RouletteBet_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "RouletteGame" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouletteBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserEconomy" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEconomy_userId_key" ON "UserEconomy"("userId");
