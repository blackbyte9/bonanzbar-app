-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN "proposedHelperPriceCents" INTEGER;

-- CreateTable
CREATE TABLE "BarSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "isOfficiallyOpen" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Consumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Consumption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consumption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Consumption" ("id", "itemId", "occurredAt", "quantity", "unitCents", "userId") SELECT "Consumption"."id", "Consumption"."itemId", "Consumption"."occurredAt", "Consumption"."quantity", COALESCE((SELECT "priceCents" FROM "InventoryItem" WHERE "InventoryItem"."id" = "Consumption"."itemId"), 0), "Consumption"."userId" FROM "Consumption";
DROP TABLE "Consumption";
ALTER TABLE "new_Consumption" RENAME TO "Consumption";
CREATE INDEX "Consumption_occurredAt_idx" ON "Consumption"("occurredAt");
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'bottle',
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "priceCents" INTEGER NOT NULL,
    "helperPriceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_InventoryItem" ("active", "category", "createdAt", "helperPriceCents", "id", "name", "priceCents", "reorderLevel", "unit", "updatedAt") SELECT "active", "category", "createdAt", "priceCents", "id", "name", "priceCents", "reorderLevel", "unit", "updatedAt" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE UNIQUE INDEX "InventoryItem_name_unit_key" ON "InventoryItem"("name", "unit");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "priceMode" TEXT NOT NULL DEFAULT 'DYNAMIC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
