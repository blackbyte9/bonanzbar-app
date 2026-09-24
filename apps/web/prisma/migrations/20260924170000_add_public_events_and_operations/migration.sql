ALTER TYPE "Role" ADD VALUE 'GUEST';
ALTER TYPE "PriceMode" ADD VALUE 'GUEST';

ALTER TABLE "InventoryItem" ADD COLUMN "guestPriceCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BarSettings"
  ADD COLUMN "dailySpecialTitle" TEXT,
  ADD COLUMN "dailySpecialDescription" TEXT,
  ADD COLUMN "dailySpecialPriceCents" INTEGER,
  ADD COLUMN "dailySpecialDate" TIMESTAMP(3),
  ADD COLUMN "dailySpecialActive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BarEvent"
  ADD COLUMN "bandInfo" TEXT,
  ADD COLUMN "bandHomepageUrl" TEXT,
  ADD COLUMN "bandImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "ticketUrl" TEXT,
  ADD COLUMN "youtubeUrl" TEXT;

CREATE TYPE "HandoverStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');
CREATE TYPE "HandoverPriority" AS ENUM ('NORMAL', 'URGENT');
CREATE TYPE "EventLedgerEntryKind" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "EventRecap" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRecap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HandoverTask" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "assigneeId" TEXT,
    "priority" "HandoverPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "HandoverStatus" NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoverTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventLedger" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventLedgerEntry" (
    "id" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "kind" "EventLedgerEntryKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "EventLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventRecap_eventId_key" ON "EventRecap"("eventId");
CREATE INDEX "EventRecap_published_publishedAt_idx" ON "EventRecap"("published", "publishedAt");
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");
CREATE INDEX "SocialComment_postId_createdAt_idx" ON "SocialComment"("postId", "createdAt");
CREATE INDEX "HandoverTask_status_priority_createdAt_idx" ON "HandoverTask"("status", "priority", "createdAt");
CREATE INDEX "HandoverTask_assigneeId_status_idx" ON "HandoverTask"("assigneeId", "status");
CREATE UNIQUE INDEX "EventLedger_eventId_key" ON "EventLedger"("eventId");
CREATE INDEX "EventLedgerEntry_ledgerId_occurredAt_idx" ON "EventLedgerEntry"("ledgerId", "occurredAt");

ALTER TABLE "EventRecap" ADD CONSTRAINT "EventRecap_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "BarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialComment" ADD CONSTRAINT "SocialComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HandoverTask" ADD CONSTRAINT "HandoverTask_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HandoverTask" ADD CONSTRAINT "HandoverTask_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventLedger" ADD CONSTRAINT "EventLedger_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "BarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventLedgerEntry" ADD CONSTRAINT "EventLedgerEntry_ledgerId_fkey"
  FOREIGN KEY ("ledgerId") REFERENCES "EventLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
