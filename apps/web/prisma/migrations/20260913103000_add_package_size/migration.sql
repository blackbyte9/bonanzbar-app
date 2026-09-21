-- Store all stock quantities as individual units while allowing counts in packages.
ALTER TABLE "InventoryItem" ADD COLUMN "packageSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_packageSize_check" CHECK ("packageSize" > 0);

ALTER TABLE "ShoppingItem" ADD COLUMN "proposedPackageSize" INTEGER;
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_proposedPackageSize_check" CHECK ("proposedPackageSize" IS NULL OR "proposedPackageSize" > 0);
