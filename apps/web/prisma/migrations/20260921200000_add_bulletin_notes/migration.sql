-- Shared organisational notes migrated from the former Bonanzbar Online bulletin.
CREATE TABLE "BulletinNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulletinNote_pinned_createdAt_idx" ON "BulletinNote"("pinned", "createdAt");
ALTER TABLE "BulletinNote" ADD CONSTRAINT "BulletinNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
