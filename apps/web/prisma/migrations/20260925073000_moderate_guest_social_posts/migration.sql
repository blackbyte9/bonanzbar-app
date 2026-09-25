ALTER TABLE "SocialPost"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT;

UPDATE "SocialPost"
SET "approvedAt" = "createdAt"
WHERE "approvedAt" IS NULL;

CREATE INDEX "SocialPost_approvedAt_createdAt_idx" ON "SocialPost"("approvedAt", "createdAt");

ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
