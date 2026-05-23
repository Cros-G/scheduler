-- CreateTable
CREATE TABLE "EmojiCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmojiCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomEmoji" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomEmoji_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EmojiCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmojiCategory_userId_idx" ON "EmojiCategory"("userId");

-- CreateIndex
CREATE INDEX "CustomEmoji_categoryId_idx" ON "CustomEmoji"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomEmoji_categoryId_emoji_key" ON "CustomEmoji"("categoryId", "emoji");
