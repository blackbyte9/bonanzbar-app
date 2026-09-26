ALTER TABLE "BarEvent"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceEventKey" TEXT,
  ADD COLUMN "sourceImportedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "BarEvent_sourceEventKey_key" ON "BarEvent"("sourceEventKey");
