-- Event board and duty sign-ups migrated from the former Bonanzbar Online feature set.
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
CREATE TYPE "DutyApplicationStatus" AS ENUM ('APPLIED', 'CONFIRMED', 'DECLINED');

CREATE TABLE "BarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventDuty" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDuty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventDutyApplication" (
    "id" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DutyApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDutyApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BarEvent_status_startsAt_idx" ON "BarEvent"("status", "startsAt");
CREATE UNIQUE INDEX "EventDuty_eventId_label_key" ON "EventDuty"("eventId", "label");
CREATE UNIQUE INDEX "EventDutyApplication_dutyId_userId_key" ON "EventDutyApplication"("dutyId", "userId");
CREATE INDEX "EventDutyApplication_userId_status_idx" ON "EventDutyApplication"("userId", "status");

ALTER TABLE "EventDuty" ADD CONSTRAINT "EventDuty_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDutyApplication" ADD CONSTRAINT "EventDutyApplication_dutyId_fkey" FOREIGN KEY ("dutyId") REFERENCES "EventDuty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDutyApplication" ADD CONSTRAINT "EventDutyApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
