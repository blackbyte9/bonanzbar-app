-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN "proposedCategory" TEXT;
ALTER TABLE "ShoppingItem" ADD COLUMN "proposedPriceCents" INTEGER;
ALTER TABLE "ShoppingItem" ADD COLUMN "proposedReorderLevel" INTEGER;
ALTER TABLE "ShoppingItem" ADD COLUMN "proposedUnit" TEXT;
