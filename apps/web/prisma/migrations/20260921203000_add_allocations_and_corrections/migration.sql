CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'RESOLVED');

CREATE TABLE "CostAllocation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsumptionCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "voidedQuantity" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumptionCorrection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Bill" ADD COLUMN "costAllocationId" TEXT;

ALTER TABLE "Consumption"
    ADD COLUMN "voidedAt" TIMESTAMP(3),
    ADD COLUMN "voidedBy" TEXT,
    ADD COLUMN "correctionId" TEXT;

CREATE INDEX "CostAllocation_createdAt_idx" ON "CostAllocation"("createdAt");
CREATE INDEX "Bill_costAllocationId_idx" ON "Bill"("costAllocationId");
CREATE INDEX "Consumption_userId_itemId_voidedAt_idx" ON "Consumption"("userId", "itemId", "voidedAt");
CREATE INDEX "ConsumptionCorrection_status_createdAt_idx" ON "ConsumptionCorrection"("status", "createdAt");
CREATE INDEX "ConsumptionCorrection_userId_createdAt_idx" ON "ConsumptionCorrection"("userId", "createdAt");

ALTER TABLE "Bill" ADD CONSTRAINT "Bill_costAllocationId_fkey"
  FOREIGN KEY ("costAllocationId") REFERENCES "CostAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Consumption" ADD CONSTRAINT "Consumption_correctionId_fkey"
  FOREIGN KEY ("correctionId") REFERENCES "ConsumptionCorrection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsumptionCorrection" ADD CONSTRAINT "ConsumptionCorrection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsumptionCorrection" ADD CONSTRAINT "ConsumptionCorrection_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
