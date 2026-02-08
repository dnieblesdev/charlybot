-- CreateTable
CREATE TABLE "AutoRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "embedTitle" TEXT,
    "embedDesc" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoleMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "autoRoleId" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "emoji" TEXT,
    "buttonLabel" TEXT,
    "buttonStyle" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleMapping_autoRoleId_fkey" FOREIGN KEY ("autoRoleId") REFERENCES "AutoRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AutoRole_guildId_idx" ON "AutoRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoRole_guildId_messageId_key" ON "AutoRole"("guildId", "messageId");

-- CreateIndex
CREATE INDEX "RoleMapping_autoRoleId_idx" ON "RoleMapping"("autoRoleId");
